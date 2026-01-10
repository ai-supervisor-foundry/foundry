# Plan: Validation Result Caching (Phase 3)

## Goal
Avoid redundant validation checks by caching results based on file content hashes. If the code hasn't changed, the validation result from the previous iteration should be reused.

## Motivation
- **Efficiency**: Validation (especially AST-based) can be expensive.
- **Loop Reduction**: Prevents "flapping" where a criterion passes then fails without code changes due to nondeterministic checks (though checks *should* be deterministic, caching enforces stability).

## Technical Approach

### 1. Cache Storage
Use an in-memory LRU cache or Redis (part of `supervisor:state` is too heavy, maybe a separate key `supervisor:cache`). Given the restart-safe requirement, Redis is better.

**Key Structure**: `validation_cache:<project_id>:<file_hash>:<criterion_hash>`
**Value**: `{ valid: boolean, timestamp: number }`

### 2. Implementation Steps

1.  **File Hashing**:
    *   Create `src/application/services/fileHasher.ts`.
    *   Use `crypto.createHash('sha256')`.
    *   Hash individual files involved in a criterion.
2.  **Cache Manager**:
    *   `src/application/services/validationCache.ts`.
    *   `getCachedResult(criterion, filePaths)`: Returns result if all file hashes match.
    *   `setCachedResult(criterion, filePaths, result)`: Updates cache.
3.  **Integration with Validator**:
    *   Inside `validateTaskOutput`:
        *   Identify relevant files (already doing this for `codeFilesToCheck`).
        *   Calculate combined hash of these files.
        *   Check cache.
        *   If hit: Return cached result.
        *   If miss: Run validation, then cache result.

### 3. Cache Invalidation
- **Implicit**: The cache key includes the file hash. If the file changes, the hash changes, so it's a cache miss naturally. No manual invalidation needed for file changes.
- **TTL**: Set a TTL (e.g., 1 hour) to prevent Redis bloat.

## Risk & Mitigation
- **Context Dependency**: Some criteria depend on *multiple* files. If we only hash one, we might miss a breaking change in another.
    *   *Mitigation*: The hash must represent the *entire* context checked. If checking "global search", we technically need to hash *all* files. This is expensive.
    *   *Refinement*: Limit caching to scoped criteria (e.g., "Check `App.tsx`"). For global checks, skip caching or accept the cost.

## Verification
- Test case: Validate a task -> "Pass". Run again without changes -> "Pass" (log shows "Cache Hit"). Change file -> "Fail/Pass" (log shows "Cache Miss").
