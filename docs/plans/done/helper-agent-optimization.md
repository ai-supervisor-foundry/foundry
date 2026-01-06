# Helper Agent Optimization Plan

**Status:** Proposal  
**Priority:** High  
**ROI:** 40-50% latency reduction on validation loops + 125k-185k tokens/day savings  
**Date:** 2026-01-04

---

## Executive Summary

Helper agent invocations are a significant source of latency and cost in the validation loop. Analysis of production logs shows that **45% of helper agent calls (5/11)** return `isValid: true` with **zero verification commands**, meaning the helper agent confirms validation WITHOUT needing to run any commands. This indicates the helper is doing work that could be done deterministically without an LLM call.

**Current Cost Per Validation Failure:**
- Main task execution: ~10-30s
- Helper agent invocation: ~18-22s (108s max observed)
- Helper agent tokens: ~2000-3000 prompt + 500-700 response
- **Total: ~28-52s + ~2500-3700 tokens**

**Proposed Optimization:**
Skip helper agent invocations when validation can be determined via fast, deterministic file system checks and pattern matching. This aligns with OpenAI's latency optimization principle: **"Don't default to an LLM"** for tasks that can be done deterministically.

**Expected Impact:**
- Skip 40-60% of helper invocations → save 10-13s per validation
- Token savings: ~125k-185k tokens/day at scale (100 validations/day)
- Net: **40-50% latency reduction on validation loops**

---

## Evidence from Production Logs

### Log Analysis Summary

**File analyzed:** `sandbox/easeclassifieds/logs/prompts.log.jsonl` (69 entries)  
**Helper agent invocations:** 11 total

**Breakdown by outcome:**
- **5/11 (45%)** - `isValid: true`, `commands: 0` - Helper confirmed without needing commands
- **6/11 (55%)** - `isValid: false`, `commands: 2-4` - Helper needed to generate verification commands

### Example of Redundant Helper Agent Call

**Most recent helper agent response (2026-01-04T15:05:50.143Z):**

```json
{
  "isValid": true,
  "verificationCommands": [],
  "reasoning": "All criteria verified: (1) Expo project created successfully - package.json with expo ~54.0.30, app.json with proper Expo configuration, tsconfig.json extending expo/tsconfig.base, dependencies installed in node_modules; (2) Project structure indicates buildability - proper entry point (index.ts with registerRootComponent), main App component (App.tsx), TypeScript configured, .expo directory present; (3) No boilerplate/demo screens - only 2 source files (App.tsx and index.ts), no boilerplate text found, no demo directories (screens/components/navigation), clean custom content 'Ease Classifieds Mobile App' instead of default Expo demo text."
}
```

**Duration:** 108,284ms (108 seconds)  
**Provider:** Copilot  
**Task:** mobile_expo_init

**Analysis:** The helper agent spent 108 seconds to:
1. Check if `package.json` contains `expo ~54.0.30`
2. Check if `app.json`, `tsconfig.json`, `index.ts`, `App.tsx` exist
3. Count source files (2 files)
4. Verify no boilerplate directories exist
5. Check for custom content in `App.tsx`

**All of these checks could be done deterministically in <1 second via file system operations.**

### Pattern: Helper Agent as File System Inspector

From the log analysis, when `isValid: true` and `commands: 0`, the helper agent reasoning shows:
- File existence checks: "package.json exists", "tsconfig.json present"
- JSON content verification: "package.json shows Expo ~54.0.30"
- Directory structure checks: "no demo directories", "only 2 source files"
- Pattern matching: "custom content instead of default demo text"

None of these require LLM reasoning - they're deterministic file system operations.

### When Helper Agent Adds Value

**Example where helper agent was useful (2026-01-04T09:58:40.632Z):**

```json
{
  "isValid": false,
  "verificationCommands": [
    "test -f package.json && grep -q '\"expo\":' package.json",
    "test -d node_modules/expo",
    "find . -name '*.tsx' -o -name '*.ts' | wc -l",
    "grep -r 'demo\\|boilerplate' src/ 2>/dev/null || echo 'No boilerplate found'"
  ],
  "reasoning": "Need to verify: (1) Expo dependency in package.json, (2) Dependencies installed, (3) File count to confirm minimal structure, (4) Absence of boilerplate text"
}
```

**This is the proper use case:** Helper agent generates commands to DISCOVER information not available in the agent response. Commands are executed, results inform validation.

**Key insight:** Helper agent should only be invoked when we need to DISCOVER information, not when we need to VERIFY information we can check ourselves.

---

## Root Cause Analysis

### Issue 1: No Pre-Filtering Before Helper Invocation

**Location:** `src/application/services/controlLoop.ts:870-950`

Current flow:
```
Validation fails → Immediately invoke helper agent → Wait 20-108s → Parse response
```

**Problem:** No attempt to validate deterministically before expensive LLM call.

**Solution:** Add pre-filter layer:
```
Validation fails → Run deterministic checks → If inconclusive → Invoke helper agent
```

### Issue 2: Helper Agent Prompt Design Encourages File Reading

**Location:** `src/domain/executors/commandGenerator.ts:145-200`

Current prompt instructs helper agent to:
```
**Your Task:**
For EACH criterion, you MUST:
1. **Read the actual code files** mentioned in the agent response (if any)
2. **Search the codebase** for implementation evidence
3. **Verify file existence** and content
4. **Check for specific patterns** (endpoints, functions, classes, etc.)
```

**Problem:** This encourages the helper to READ files when it could generate COMMANDS to read files, or we could skip the helper entirely.

**Current behavior:** Helper reads files itself → returns `isValid: true, commands: []`  
**Better behavior:** Skip helper → we read files ourselves → deterministic validation

### Issue 3: No Session Reuse for Helper Agents

**Location:** `src/application/services/controlLoop.ts:870-880`

Helper agent sessions are tracked but not consistently reused:
```typescript
const helperFeatureId = `helper-${task.task_id}`;  // Task-specific
const helperSessionId = await sessionManager.resolveSession(
  task.tool,
  helperFeatureId,
  undefined,
  state
);
```

**Problem:** Each helper call for the same project starts fresh, losing codebase context.

**Token waste:** Same codebase file list (~1000-1500 tokens) sent every time.

**Solution:** Use project-level helper session: `helper-${projectId}-validation`

---

## Proposed Solution Architecture

### Three-Tier Validation Strategy

```
┌─────────────────────────────────────────────────────────────┐
│ Tier 1: Deterministic Pre-Validation (NEW)                 │
│ - File existence checks                                     │
│ - JSON/config parsing                                       │
│ - Directory structure validation                            │
│ - Pattern matching in known files                           │
│ - Duration: <1s                                             │
│ - Success rate: 40-60% (based on log analysis)             │
└─────────────────────────────────────────────────────────────┘
                        ↓ (if inconclusive)
┌─────────────────────────────────────────────────────────────┐
│ Tier 2: Helper Agent with Commands (EXISTING)              │
│ - LLM generates verification commands                       │
│ - Commands executed in sandbox                              │
│ - Results parsed for validation                             │
│ - Duration: ~18-108s                                        │
│ - Used when: Discovery needed, ambiguous cases              │
└─────────────────────────────────────────────────────────────┘
                        ↓ (if still inconclusive)
┌─────────────────────────────────────────────────────────────┐
│ Tier 3: Retry or Manual Intervention (EXISTING)            │
│ - Task retry with clarification                             │
│ - Or mark as blocked for operator review                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Deterministic Pre-Validation (1) - HIGH PRIORITY

**Goal:** Skip 30-40% of helper invocations via fast checks

**New File:** `src/application/services/deterministicValidator.ts`

```typescript
/**
 * Deterministic Validation - Fast file-based checks before helper agent
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface DeterministicValidationResult {
  canValidate: boolean;  // Can we determine validation without helper?
  valid?: boolean;       // If canValidate=true, is validation passing?
  reason?: string;       // Explanation
  confidence: 'high' | 'medium' | 'low';
}

export interface CriterionCheck {
  type: 'file_exists' | 'file_not_exists' | 'json_contains' | 'json_not_contains' | 
        'file_count' | 'directory_exists' | 'grep_found' | 'grep_not_found';
  path?: string;         // File/directory path
  pattern?: string;      // JSON key, grep pattern, or glob pattern
  value?: any;           // Expected value (for json_contains)
  count?: { min?: number; max?: number };  // For file_count
}

export interface CriterionMapping {
  keywords: RegExp[];    // Patterns to match in criterion text
  checks: CriterionCheck[];
}

// Criterion → Check mappings
const DETERMINISTIC_VALIDATION_RULES: Record<string, CriterionMapping> = {
  expo_project: {
    keywords: [
      /expo.*project.*(created|initialized|setup)/i,
      /create.*expo.*project/i,
    ],
    checks: [
      { type: 'file_exists', path: 'package.json' },
      { type: 'json_contains', path: 'package.json', pattern: 'expo' },
      { type: 'file_exists', path: 'app.json' },
      { type: 'file_exists', path: 'tsconfig.json' },
    ]
  },
  
  no_boilerplate: {
    keywords: [
      /no.*(boilerplate|demo|template|example|sample)/i,
      /remove.*(boilerplate|demo)/i,
      /clean.*structure/i,
    ],
    checks: [
      { type: 'file_count', pattern: 'src/**/*.{ts,tsx}', count: { max: 5 } },
      { type: 'directory_exists', path: 'screens', negate: true },
      { type: 'directory_exists', path: 'components/demo', negate: true },
      { type: 'grep_not_found', path: 'src', pattern: 'boilerplate|demo|example' },
    ]
  },
  
  dependencies_installed: {
    keywords: [
      /dependencies.*(installed|added|present)/i,
      /npm install/i,
      /node_modules/i,
    ],
    checks: [
      { type: 'directory_exists', path: 'node_modules' },
      { type: 'file_exists', path: 'package-lock.json' },
    ]
  },
  
  typescript_configured: {
    keywords: [
      /typescript.*(configured|setup)/i,
      /tsconfig/i,
    ],
    checks: [
      { type: 'file_exists', path: 'tsconfig.json' },
      { type: 'json_contains', path: 'tsconfig.json', pattern: 'compilerOptions' },
    ]
  },
  
  builds_successfully: {
    keywords: [
      /(builds?|compiles?).*(success|without.*error)/i,
      /project.*builds?/i,
    ],
    checks: [
      { type: 'file_exists', path: 'package.json' },
      { type: 'json_contains', path: 'package.json', pattern: 'scripts.build' },
      // Note: Cannot actually verify build success without running build
      // This is a case where helper agent or command execution is needed
    ]
  },
};

/**
 * Attempt to validate criteria deterministically before invoking helper agent
 */
export async function attemptDeterministicValidation(
  failedCriteria: string[],
  agentResponse: string,
  sandboxCwd: string
): Promise<DeterministicValidationResult> {
  
  const results: { criterion: string; canValidate: boolean; valid?: boolean; confidence: string }[] = [];
  
  for (const criterion of failedCriteria) {
    // Try to map criterion to known check patterns
    const mapping = findCriterionMapping(criterion);
    
    if (!mapping) {
      // Cannot validate this criterion deterministically
      results.push({ criterion, canValidate: false, confidence: 'low' });
      continue;
    }
    
    // Execute deterministic checks
    const checkResults = await executeChecks(mapping.checks, sandboxCwd);
    
    results.push({
      criterion,
      canValidate: true,
      valid: checkResults.allPassed,
      confidence: checkResults.confidence
    });
  }
  
  // Determine overall result
  const canValidateAll = results.every(r => r.canValidate);
  
  if (!canValidateAll) {
    return {
      canValidate: false,
      confidence: 'low',
      reason: 'Some criteria require helper agent for verification'
    };
  }
  
  const allValid = results.every(r => r.valid === true);
  const highConfidence = results.every(r => r.confidence === 'high');
  
  return {
    canValidate: true,
    valid: allValid,
    confidence: highConfidence ? 'high' : 'medium',
    reason: allValid 
      ? `All ${failedCriteria.length} criteria verified deterministically` 
      : `${results.filter(r => !r.valid).length} criteria still failing after deterministic checks`
  };
}

function findCriterionMapping(criterion: string): CriterionMapping | null {
  for (const mapping of Object.values(DETERMINISTIC_VALIDATION_RULES)) {
    if (mapping.keywords.some(regex => regex.test(criterion))) {
      return mapping;
    }
  }
  return null;
}

async function executeChecks(
  checks: CriterionCheck[], 
  sandboxCwd: string
): Promise<{ allPassed: boolean; confidence: 'high' | 'medium' | 'low' }> {
  // Implementation of actual file system checks
  // Returns whether all checks passed and confidence level
  
  for (const check of checks) {
    const passed = await executeCheck(check, sandboxCwd);
    if (!passed) {
      return { allPassed: false, confidence: 'high' };
    }
  }
  
  return { allPassed: true, confidence: 'high' };
}

async function executeCheck(check: CriterionCheck, sandboxCwd: string): Promise<boolean> {
  const fullPath = path.join(sandboxCwd, check.path || '');
  
  switch (check.type) {
    case 'file_exists':
      return await fileExists(fullPath);
    
    case 'file_not_exists':
      return !(await fileExists(fullPath));
    
    case 'json_contains':
      return await jsonContains(fullPath, check.pattern!, check.value);
    
    case 'directory_exists':
      return await directoryExists(fullPath);
    
    // ... implement other check types
    
    default:
      return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function jsonContains(path: string, key: string, value?: any): Promise<boolean> {
  try {
    const content = await fs.readFile(path, 'utf8');
    const json = JSON.parse(content);
    
    // Navigate nested keys (e.g., "scripts.build")
    const keys = key.split('.');
    let current = json;
    for (const k of keys) {
      if (!(k in current)) return false;
      current = current[k];
    }
    
    if (value !== undefined) {
      return current === value;
    }
    
    return true;  // Key exists
  } catch {
    return false;
  }
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
```

**Integration Point:** `src/application/services/controlLoop.ts:870`

```typescript
// BEFORE helper agent invocation
if (!validationReport.valid) {
  // NEW: Try deterministic validation first
  const deterministicResult = await attemptDeterministicValidation(
    validationReport.failed_criteria || [],
    providerResult.rawOutput || providerResult.stdout || '',
    sandboxCwd
  );
  
  if (deterministicResult.canValidate && deterministicResult.confidence === 'high') {
    log(`[Iteration ${iteration}] Task ${task.task_id}: Deterministic validation result: ${deterministicResult.valid}`);
    
    if (deterministicResult.valid) {
      // Validation passed via deterministic checks - skip helper agent
      validationReport.valid = true;
      validationReport.reason = `Deterministic validation: ${deterministicResult.reason}`;
      // Continue to success handling
    } else {
      // Still failing after deterministic checks - proceed to helper agent or retry
      log(`[Iteration ${iteration}] Task ${task.task_id}: Deterministic validation failed, invoking helper agent`);
      // Continue to existing helper agent invocation
    }
  } else {
    // Cannot validate deterministically - use helper agent as before
    log(`[Iteration ${iteration}] Task ${task.task_id}: Cannot validate deterministically, invoking helper agent`);
    // Continue to existing helper agent invocation
  }
}
```

**Expected Result:** Skip 30-40% of helper invocations

---

### Phase 2: Enhanced Criterion Mapping System (2) - MEDIUM PRIORITY

**Goal:** Increase deterministic validation coverage to 50-70%

**Strategy:** Build richer criterion → check mappings

**Enhancements to `deterministicValidator.ts`:**

1. **Add more criterion patterns** (common acceptance criteria)
   - API endpoints created
   - Database schemas/migrations
   - Configuration files present
   - Test files exist
   - Documentation updated

2. **Support composite checks** (multiple conditions)
   ```typescript
   {
     type: 'composite_and',
     checks: [
       { type: 'file_exists', path: 'package.json' },
       { type: 'json_contains', path: 'package.json', pattern: 'dependencies.react' }
     ]
   }
   ```

3. **Add fuzzy matching** for criteria text
   - Use string similarity algorithms
   - Learn from past validations (store criterion → checks mappings)

4. **Validation confidence scoring**
   ```typescript
   function calculateConfidence(checks: CheckResult[]): 'high' | 'medium' | 'low' {
     // High: All checks are file existence or JSON parsing
     // Medium: Some checks involve pattern matching or counting
     // Low: Checks require semantic understanding or execution
   }
   ```

**Expected Result:** Skip 50-70% of helper invocations

---

### Phase 3: Helper Agent Session Optimization (3) - MEDIUM PRIORITY

**Goal:** Reduce token costs for remaining helper invocations by 30-60%

**Problem:** Helper agents spawn fresh sessions, losing codebase context.

**Solution:** Use project-level session with caching.

**Location:** `src/application/services/controlLoop.ts:870-880`

**Change:**
```typescript
// BEFORE
const helperFeatureId = `helper-${task.task_id}`;  // Task-specific

// AFTER  
const helperFeatureId = `helper-validation-${projectId}`;  // Project-specific
```

**Benefit:** 
- Same codebase file list cached (~1000-1500 tokens)
- Same working directory context cached
- Helper "learns" project structure over time

**Token savings:** 30-60% per helper invocation (based on prompt caching research)

**Expected Result:** 30-60% token reduction on helper agent calls

---

### Phase 4: Monitoring & Metrics (4) - LOW PRIORITY

**Goal:** Measure optimization impact and tune skip thresholds

**New Metrics to Track:**

```typescript
interface ValidationMetrics {
  // Deterministic validation
  deterministic_attempts: number;
  deterministic_success: number;
  deterministic_skip_rate: number;  // success / attempts
  deterministic_false_positives: number;  // skipped but would have failed
  
  // Helper agent
  helper_invocations: number;
  helper_duration_avg: number;
  helper_duration_p95: number;
  helper_tokens_avg: number;
  
  // Overall
  validation_loop_duration_avg: number;
  validation_loop_duration_reduction: number;  // vs baseline
}
```

**Logging additions:**

```typescript
log(`[Metrics] Deterministic validation skip rate: ${skipRate.toFixed(1)}%`);
log(`[Metrics] Helper agent duration avg: ${avgDuration}ms`);
log(`[Metrics] Token savings: ${tokenSavings} tokens`);
```

**Dashboard queries** (for Grafana/Datadog):
- Helper agent skip rate over time
- Average validation loop duration (before/after optimization)
- Token usage comparison (baseline vs optimized)

**Expected Result:** Data-driven optimization tuning

---

## Risks & Mitigations

### Risk 1: False Positives (Skipping Helper When Needed)

**Scenario:** Deterministic checks pass, but actual validation should fail.

**Example:**
- Criterion: "API endpoint returns correct data"
- Deterministic check: File `routes/api.ts` exists ✓
- Reality: Endpoint exists but has logic bug

**Mitigation:**
1. **Start conservative:** Only skip when 100% certain (e.g., file existence for "file created" criteria)
2. **A/B testing:** Run deterministic + helper in parallel for 10% of traffic, compare results
3. **Monitoring:** Track task retry rates before/after optimization
4. **Confidence thresholds:** Only skip if confidence = 'high'
5. **Logging:** Log all "would have skipped helper" decisions for analysis

**Rollback plan:** Feature flag to disable deterministic pre-validation

---

### Risk 2: Validation Quality Degradation

**Scenario:** Less thorough validation leads to tasks marked complete incorrectly.

**Indicators:**
- Increased task retry rate
- More blocked tasks
- Operator reports of "false completed" tasks

**Mitigation:**
1. **Baseline metrics:** Record current validation success rate (before optimization)
2. **Quality gates:** If retry rate increases >10%, revert optimization
3. **Gradual rollout:** Enable for 10% → 50% → 100% of tasks
4. **Keep validation rules strict:** Deterministic validation should be AS strict as helper agent
5. **Audit logging:** All deterministic validation decisions logged for review

---

### Risk 3: Maintenance Burden (Criterion Mappings)

**Scenario:** Need to manually maintain criterion → check mappings as tasks evolve.

**Mitigation:**
1. **Centralized config:** Single file `src/config/deterministicValidationRules.ts`
2. **Pattern-based matching:** Use regex for flexible criterion matching
3. **Learning system:** Log "could not map criterion" events, auto-suggest mappings
4. **Documentation:** Clear guide for adding new criterion mappings
5. **Automated tests:** Unit tests for each criterion mapping

**Long-term solution:** ML-based criterion → check mapping (Phase 5, future work)

---

## Success Criteria

### Quantitative Metrics

1. **Helper Agent Skip Rate:** 40-60% (baseline: 0%)
2. **Validation Loop Latency:** Reduce by 40-50%
   - Baseline: ~28-52s per validation failure
   - Target: ~15-30s per validation failure
3. **Token Usage:** Reduce by 30-50%
   - Baseline: ~2500-3700 tokens per validation
   - Target: ~1250-2500 tokens per validation
4. **Task Success Rate:** Maintain >95% (no degradation)

### Qualitative Metrics

1. **Code maintainability:** Criterion mappings are clear and well-documented
2. **Operator confidence:** No increase in "false completed" task reports
3. **System reliability:** No increase in validation-related errors

---

## Testing Strategy

### Phase 1 Testing (Deterministic Validation)

**Unit Tests:**
```typescript
describe('DeterministicValidator', () => {
  it('should validate expo project creation criteria', async () => {
    // Setup: Create mock file system with package.json, app.json, etc.
    // Execute: attemptDeterministicValidation(["Expo project created"], ...)
    // Assert: canValidate=true, valid=true, confidence='high'
  });
  
  it('should detect missing files correctly', async () => {
    // Setup: Empty directory
    // Execute: attemptDeterministicValidation(["Expo project created"], ...)
    // Assert: canValidate=true, valid=false, confidence='high'
  });
  
  it('should return canValidate=false for semantic criteria', async () => {
    // Execute: attemptDeterministicValidation(["Code is readable"], ...)
    // Assert: canValidate=false (cannot check readability deterministically)
  });
});
```

**Integration Tests:**
```typescript
describe('ControlLoop with DeterministicValidator', () => {
  it('should skip helper agent when deterministic validation passes', async () => {
    // Setup: Mock task with file-based criteria, create expected files
    // Execute: Run control loop iteration
    // Assert: Helper agent NOT invoked, task marked complete
  });
  
  it('should invoke helper agent when deterministic validation inconclusive', async () => {
    // Setup: Mock task with semantic criteria
    // Execute: Run control loop iteration
    // Assert: Helper agent WAS invoked
  });
});
```

**Manual Testing:**
- Run supervisor with logging enabled
- Monitor: `[Metrics] Deterministic validation skip rate`
- Verify: Tasks complete successfully when helper skipped

---

### Phase 2 Testing (Enhanced Mappings)

**Regression Tests:**
- Ensure existing criterion mappings still work
- Test new criterion patterns

**Fuzzy Matching Tests:**
- Variations of criterion text should map to same checks
- Example: "create expo project" vs "expo project is created" vs "initialize Expo app"

---

### Phase 3 Testing (Session Optimization)

**Session Reuse Verification:**
```bash
# Check helper session reuse in logs
grep "Helper session.*updated" logs/supervisor-combined.log | \
  grep "helper-validation-easeclassifieds" | \
  tail -10
```

**Token Usage Comparison:**
- Measure tokens before/after session optimization
- Verify 30-60% reduction

---

## Rollout Plan

### 1: Implement & Test Phase 1
- **Mon-Tue:** Implement `deterministicValidator.ts` core
- **Wed:** Add criterion mappings for common patterns
- **Thu:** Integration with controlLoop.ts
- **Fri:** Unit tests + integration tests

### 2: Deploy Phase 1 + Start Phase 2
- **Mon:** Deploy Phase 1 to staging
- **Tue:** Monitor metrics (skip rate, latency, success rate)
- **Wed-Thu:** Implement Phase 2 (enhanced mappings)
- **Fri:** Review Phase 1 metrics, deploy Phase 2 to staging

### 3: Phase 3 + Production Rollout
- **Mon:** Implement Phase 3 (session optimization)
- **Tue:** Test Phase 3 in staging
- **Wed:** Deploy Phases 1+2+3 to production (10% traffic)
- **Thu:** Monitor production metrics closely
- **Fri:** Increase to 50% traffic if metrics look good

### 4: Full Rollout + Monitoring
- **Mon:** Increase to 100% traffic
- **Tue-Wed:** Implement Phase 4 (metrics dashboard)
- **Thu:** Review full week of production data
- **Fri:** Write post-mortem/retrospective document

---

## Future Work (Post-MVP)

### Phase 5: ML-Based Validation Confidence (Research Spike)

**Concept:** Train a classifier to predict:
- Input: Criterion text + agent response excerpt
- Output: `{ canValidateDeterministically: boolean, suggestedChecks: Check[] }`

**Training Data:**
- Historical validation logs (criterion, agent response, helper result)
- Label: Was helper needed? What checks would have sufficed?

**Approach:**
1. Embeddings-based similarity (find similar past criteria)
2. Small fine-tuned model (BERT/GPT-3.5 fine-tune)
3. Rule extraction from helper agent patterns

**Expected Result:** Optimal skip rate (70-80%) while maintaining quality

---

### Phase 6: Auto-Generate Criterion Mappings

**Concept:** When helper agent generates commands, learn from them.

**Example:**
- Criterion: "API endpoint /api/users returns user list"
- Helper generates: `curl localhost:3000/api/users | jq '.users'`
- System learns: For "API endpoint" criteria → generate curl commands

**Implementation:**
- Store: criterion pattern → helper commands → success/failure
- Next time: Skip helper, directly generate similar commands

---

## References

### Internal Documentation
- [Session Reuse Optimization](./session-reuse-optimization.md) - Helper agent session caching
- [Prompt Tightening Plan](./prompt-tightening-plan.md) - Token optimization strategies
- [Validation Guide](../VALIDATION.md) - Current validation logic
- [AST Validation Guide](../AST_VALIDATION_GUIDE.md) - Deterministic code validation

### External Research
- [OpenAI Latency Optimization](https://platform.openai.com/docs/guides/latency-optimization)
  - Principle: "Don't default to an LLM" for deterministic tasks
  - Principle: "Make fewer requests" to reduce round-trip latency
- [Anthropic Prompt Caching](https://www.anthropic.com/news/prompt-caching)
  - 30-60% token cost reduction via prompt caching

### Production Evidence
- Log file: `sandbox/easeclassifieds/logs/prompts.log.jsonl`
- 11 helper agent invocations analyzed
- 45% skip opportunity identified (5/11 returned isValid=true with 0 commands)

---

## Conclusion

Helper agent optimization presents a significant opportunity to reduce both latency and cost in the validation loop. The data shows that nearly half of helper agent invocations are doing work that could be done deterministically in a fraction of the time.

By implementing a three-tier validation strategy (deterministic → helper agent → retry), we can:
- **Reduce validation loop latency by 40-50%**
- **Save 125k-185k tokens per day at scale**
- **Maintain validation quality** through careful testing and monitoring

The phased rollout plan ensures we can measure impact at each stage and rollback if needed. Starting with conservative deterministic checks and gradually expanding coverage based on real-world results is the safest path forward.

**Recommendation:** Begin with Phase 1 implementation (deterministic pre-validation) as it offers the highest immediate return with lowest risk.
