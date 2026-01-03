# Plan: AST-Based Validation (Phase 3)

## Goal
Replace the current keyword/regex-based validation with Abstract Syntax Tree (AST) analysis. This will allow the Supervisor to definitively verify code structure (class existence, method signatures, decorators, exports) rather than just checking for text presence.

## Motivation
- **False Positives**: Regex matches comments (`// TODO: Add login function`) as valid implementations.
- **False Negatives**: Regex fails on varied formatting (e.g., `function login()` vs `const login = () =>`).
- **Safety**: Ensuring code is syntactically valid before accepting it.

## Technical Approach

### 1. Library Selection
Use **`ts-morph`** (wrapper around TypeScript Compiler API) for easy AST navigation and manipulation. It handles TS/JS/JSX/TSX parsing robustly.

### 2. Validation Logic (`src/application/services/validator.ts`)

Extend the `validateTaskOutput` logic to route "coding" tasks through an AST validator.

```typescript
// New Interface
interface ASTValidationRule {
  type: 'ast';
  criterion: string;
  pattern: {
    kind: 'Function' | 'Class' | 'Interface' | 'Variable' | 'Decorator';
    name: string | RegExp;
    properties?: string[]; // e.g., for Interface
    methods?: string[]; // e.g., for Class
    exported?: boolean;
  };
}
```

### 3. Implementation Steps

1.  **Install Dependencies**: `npm install ts-morph`
2.  **Create Service**: `src/application/services/astValidator.ts`
    *   Initialize `Project` from `ts-morph`.
    *   `addSourceFilesAtPaths` from the sandbox directory.
3.  **Implement Matchers**:
    *   `checkFunction(name)`: Returns true if function declaration or arrow function assignment exists.
    *   `checkClass(name, methods)`: Verifies class and its members.
    *   `checkExport(name)`: Verifies named or default export.
4.  **Integrate with Validator**:
    *   In `validator.ts`, if `task_type === 'coding'`, try AST validation first.
    *   Parse `acceptance_criteria` to infer AST rules (or use an LLM pre-processor to convert natural language criteria to AST rules).
    *   *Fallback*: If AST fails or is too complex, fall back to the existing keyword search (with a "LOW" confidence warning).

### 4. Code Discovery Update
Ensure the AST validator can "see" all relevant files. It should load `tsconfig.json` if available to understand aliases, but fallback to file globbing if not.

## Risk & Mitigation
- **Performance**: AST parsing is slower than regex.
    *   *Mitigation*: Only parse modified files (use `state.updated_files` logic if available) or use Caching (see `validation-caching.md`).
- **Complexity**: Natural language criteria ("Create a login page") are hard to map to AST.
    *   *Mitigation*: Keep using Keyword/Behavioral validation for high-level intents. Use AST for specific technical criteria ("Export a `Login` component").

## Verification
- Unit tests with sample TS files (valid vs invalid structure).
- Integration test with a Supervisor task "Create `utils.ts` with function `sum`".
