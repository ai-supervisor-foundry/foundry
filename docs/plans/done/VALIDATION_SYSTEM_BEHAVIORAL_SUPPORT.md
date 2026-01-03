# Validation System: Behavioral Task Support

## Executive Summary

Analysis of task `testing-0091` (87+ iterations, infinite validation loop) revealed fundamental architectural mismatches between the supervisor's file-based validation system and behavioral/conversational task requirements. This plan addresses the gap by adding task type awareness, behavioral validation support, and robust escape mechanisms.

## Problem Statement

### Root Cause Analysis

**Task testing-0091 Failed Due To:**

1. **Task Type Mismatch**: System designed for file-based coding tasks, but task is conversational/behavioral
   - Acceptance criteria: "Greet", "Respond concisely", "Respond separately per message"
   - No file artifacts expected or produced
   - Validator searches codebase for keywords, finds nothing
   - Interrogation system generates file verification commands (grep), all fail
   
2. **Invalid Model Configuration**: Task has `agent_mode: "gemini-2.5-flash-lite"` with invalid model name
   - Model name `"gemini-2.5-flash-lite"` not recognized by the CLI being used
   - Every execution attempt fails: `error: option '--model <model>' argument 'gemini-2.5-flash-lite' is invalid`
   - Retry loop continues despite consistent CLI errors
   - Note: `agent_mode` field is valid and should remain untouched; issue is provider/agent-specific model compatibility

3. **Interrogation System Blind Spot**: Helper Agent and interrogation assume file artifacts exist
   - Helper Agent V2 generates commands: `grep -ri "Greet" easeclassifieds`
   - All commands return zero matches (exitCode=0 but no content found)
   - Pre-analysis finds no relevant files for behavioral criteria
   - Agent asked "where did you implement Greet?" when implementation is conversational, not code

4. **JSON Parsing Failure**: Agent wraps JSON in markdown code blocks despite explicit instructions
   - Prompt states: "Return ONLY the JSON object. Do not wrap it in markdown code blocks"
   - Agent response: `"```json\n{...}\n```"`
   - Parser fails: `"Invalid JSON response format from agent"`
   - All interrogation rounds fail with same format violation

5. **No Escape Mechanism**: Max retries exhausted but supervisor continues cycling
   - Iterations visible: 0, 62, 87 (keeps incrementing)
   - FIX_PROMPT loop triggers on every failed validation
   - No detection of "hopeless case" (repeated identical errors)
   - No operator intervention mechanism

### Impact

- **Resource waste**: 87+ iterations with no progress
- **Cost overhead**: Tokens consumed on doomed retry attempts
- **User confusion**: Task appears stuck, no clear feedback on why
- **System fragility**: Similar tasks will fail identically

## Current Architecture Constraints

### Validation System (from VALIDATION.md)

```typescript
// Current design: File-based only
interface ValidationRule {
  type: 'file_exists' | 'test_passes' | 'keyword_match' | 'diff_contains';
  criterion: string;
  config: {
    file_path?: string;
    test_command?: string;
    keywords?: string[];
  };
}
```

**Key constraint**: "Validation logic must be deterministic, rule-based, and non-AI"
- Designed for: File existence, test execution, code patterns
- Not designed for: Conversational responses, behavioral compliance, agent personality

### Interrogation System (from ARCHITECTURE_DETAILED.md)

```typescript
// Helper Agent V2 generates verification commands
async function generateVerificationCommands(
  criterion: string,
  agentResponse: string,
  codeFiles: string[]
): Promise<{ isValid: boolean; commands: string[] }> {
  // Assumption: Implementation exists as code artifact
  // Generates: grep, find, ls commands to locate files
}
```

**Key constraint**: Assumes implementation = file changes
- Pre-analysis searches codebase for keyword matches
- Interrogation asks "where did you implement X?"
- Evidence must be file paths + code snippets

## Proposed Solution

### Phase 1: Task Type Detection (High Priority)

#### 1.1 Add Task Type Annotation

**Schema Update** (`TASK_SCHEMA.json` + Domain models):

```typescript
type TaskType = 'coding' | 'behavioral' | 'configuration' | 'testing' | 'documentation';

interface Task {
  task_id: string;
  task_type?: TaskType; // Optional, defaults to 'coding'
  intent: string;
  instructions: string;
  acceptance_criteria: string[];
  // ... existing fields
}
```

**Detection Logic** (for legacy tasks without explicit type):

```typescript
function detectTaskType(task: Task): TaskType {
  const text = `${task.intent} ${task.instructions}`.toLowerCase();
  
  // Behavioral indicators
  if (
    text.match(/\b(greet|hello|respond|conversational|dialogue)\b/) &&
    !text.match(/\b(implement|create|add|build|file|component)\b/)
  ) {
    return 'behavioral';
  }
  
  // Configuration indicators
  if (text.match(/\b(configure|setup|environment|install|deploy)\b/)) {
    return 'configuration';
  }
  
  // Testing indicators
  if (text.match(/\b(test|spec|assertion|coverage|verify)\b/)) {
    return 'testing';
  }
  
  // Documentation indicators
  if (text.match(/\b(document|readme|write.*doc|explain)\b/)) {
    return 'documentation';
  }
  
  return 'coding'; // Default
}
```

#### 1.2 Model Name Validation on Enqueue

**Location**: `src/application/use-cases/enqueue-task.usecase.ts`

```typescript
const VALID_MODELS = [
  'claude-sonnet-4.5',
  'claude-haiku-4.5',
  'claude-opus-4.5',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex',
  'gpt-5.2',
  'gpt-5.1',
  'gpt-5',
  'gemini-3-pro-preview'
] as const;

function validateTaskOnEnqueue(task: Task): ValidationResult {
  // Note: agent_mode field is left as-is, no validation
  // Future enhancement: Add provider/agent-specific model validation if needed
  
  // Check: Validate working_directory matches project structure
  if (task.working_directory && !task.working_directory.includes(task.project_id || '')) {
    return {
      valid: false,
      error: `working_directory "${task.working_directory}" should contain project_id or use relative path`
    };
  }
  
  return { valid: true };
}
```

### Phase 2: Behavioral Validation Support (High Priority)

#### 2.1 Add Behavioral Validation Rules

**Updated Validator Interface**:

```typescript
interface ValidationRule {
  type: 'file_exists' | 'test_passes' | 'keyword_match' | 'diff_contains' | 'behavioral_check';
  criterion: string;
  config: {
    // Existing configs...
    
    // NEW: Behavioral validation config
    behavioral?: {
      check_type: 'response_content' | 'response_format' | 'response_length' | 'response_tone';
      expected_patterns?: RegExp[];
      min_length?: number;
      max_length?: number;
      forbidden_patterns?: RegExp[];
    };
  };
}
```

#### 2.2 Behavioral Validator Implementation

**Location**: `src/domain/validators/behavioral-validator.ts`

```typescript
export class BehavioralValidator {
  /**
   * Validate behavioral criteria against agent response content
   * Does NOT search codebase, only analyzes response text
   */
  async validate(
    criterion: string,
    agentResponse: string,
    config?: BehavioralValidationConfig
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      criterion,
      passed: false,
      confidence: 'LOW',
      evidence: [],
      matchQuality: 'NONE'
    };
    
    // Extract actual text response (strip JSON wrapper if present)
    const responseText = this.extractResponseText(agentResponse);
    
    // Check: "Greet" criterion
    if (criterion.toLowerCase().includes('greet')) {
      const greetingPatterns = /\b(hello|hi|greetings|welcome|hey)\b/i;
      if (greetingPatterns.test(responseText)) {
        result.passed = true;
        result.confidence = 'HIGH';
        result.matchQuality = 'EXACT';
        result.evidence.push(`Found greeting in response: "${responseText.substring(0, 50)}..."`);
      }
    }
    
    // Check: "Respond concisely" criterion
    if (criterion.toLowerCase().includes('concise')) {
      const wordCount = responseText.split(/\s+/).length;
      if (wordCount <= 50) { // Configurable threshold
        result.passed = true;
        result.confidence = 'HIGH';
        result.matchQuality = 'EXACT';
        result.evidence.push(`Response is concise: ${wordCount} words`);
      } else {
        result.evidence.push(`Response too long: ${wordCount} words (expected ≤ 50)`);
      }
    }
    
    // Check: "Respond separately per message" criterion
    if (criterion.toLowerCase().includes('separately')) {
      const separateResponses = responseText.split('\n').filter(line => line.trim().length > 0);
      if (separateResponses.length >= 2) {
        result.passed = true;
        result.confidence = 'MEDIUM'; // Medium because interpretation varies
        result.matchQuality = 'HIGH';
        result.evidence.push(`Response has ${separateResponses.length} separate parts`);
      }
    }
    
    // Generic pattern matching for other behavioral criteria
    if (!result.passed && config?.behavioral?.expected_patterns) {
      for (const pattern of config.behavioral.expected_patterns) {
        if (pattern.test(responseText)) {
          result.passed = true;
          result.confidence = 'MEDIUM';
          result.matchQuality = 'HIGH';
          result.evidence.push(`Response matches expected pattern: ${pattern.source}`);
          break;
        }
      }
    }
    
    return result;
  }
  
  private extractResponseText(agentResponse: string): string {
    try {
      // Try parsing as JSON (Gemini CLI returns JSON wrapper)
      const parsed = JSON.parse(agentResponse);
      return parsed.response || parsed.message || agentResponse;
    } catch {
      return agentResponse;
    }
  }
}
```

#### 2.3 Task-Type-Aware Validation Router

**Location**: `src/domain/validators/validator.service.ts`

```typescript
export class ValidatorService {
  constructor(
    private fileBasedValidator: FileBasedValidator,
    private behavioralValidator: BehavioralValidator
  ) {}
  
  async validate(
    task: Task,
    agentResponse: string,
    sandboxRoot: string
  ): Promise<ValidationReport> {
    const taskType = task.task_type || detectTaskType(task);
    
    const results: ValidationResult[] = [];
    
    for (const criterion of task.acceptance_criteria) {
      let result: ValidationResult;
      
      if (taskType === 'behavioral') {
        // Use behavioral validator (no file checks)
        result = await this.behavioralValidator.validate(
          criterion,
          agentResponse
        );
      } else {
        // Use file-based validator (existing logic)
        result = await this.fileBasedValidator.validate(
          criterion,
          agentResponse,
          sandboxRoot
        );
      }
      
      results.push(result);
    }
    
    return this.buildValidationReport(results);
  }
}
```

### Phase 3: Interrogation System Improvements (Medium Priority)

#### 3.1 Skip Interrogation for Behavioral Tasks

**Location**: `src/application/use-cases/validate-output.usecase.ts`

```typescript
async function shouldInterrogate(
  task: Task,
  validationReport: ValidationReport
): Promise<boolean> {
  // Don't interrogate if task is behavioral (no files to check)
  const taskType = task.task_type || detectTaskType(task);
  if (taskType === 'behavioral') {
    logger.info('Skipping interrogation for behavioral task', {
      task_id: task.task_id,
      task_type: taskType
    });
    return false;
  }
  
  // Existing logic for file-based tasks
  const hasLowConfidence = validationReport.results.some(
    r => r.confidence === 'LOW' || r.confidence === 'UNCERTAIN'
  );
  
  return hasLowConfidence;
}
```

#### 3.2 Improved JSON Parsing with Fallback

**Location**: `src/infrastructure/cli/interrogation-parser.ts`

```typescript
export function parseInterrogationResponse(rawResponse: string): InterrogationResult {
  let jsonStr = rawResponse.trim();
  
  // Strip markdown code blocks if present
  const markdownJsonPattern = /^```json\s*\n?([\s\S]*?)\n?```$/;
  const match = jsonStr.match(markdownJsonPattern);
  if (match) {
    jsonStr = match[1].trim();
    logger.warn('Agent wrapped JSON in markdown code block despite instructions', {
      original_length: rawResponse.length,
      extracted_length: jsonStr.length
    });
  }
  
  // Try parsing
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    logger.error('Failed to parse interrogation response', {
      error: error.message,
      raw_response_preview: rawResponse.substring(0, 200)
    });
    
    // Return UNCERTAIN result instead of throwing
    return {
      results: {},
      error: 'Invalid JSON format',
      raw_response: rawResponse
    };
  }
}
```

### Phase 4: Escape Mechanisms (High Priority)

#### 4.1 Repeated Error Detection

**Location**: `src/domain/services/retry-manager.service.ts`

```typescript
interface RetryAttempt {
  iteration: number;
  error_message: string;
  timestamp: number;
}

export class RetryManager {
  private attemptHistory: Map<string, RetryAttempt[]> = new Map();
  
  shouldRetry(
    task: Task,
    currentIteration: number,
    error: Error | null
  ): { shouldRetry: boolean; reason: string; action?: 'block' | 'escalate' } {
    const history = this.attemptHistory.get(task.task_id) || [];
    
    // Check for repeated identical errors (indicates hopeless case)
    if (error) {
      const errorMsg = error.message;
      const recentErrors = history.slice(-5);
      const identicalErrors = recentErrors.filter(h => h.error_message === errorMsg);
      
      if (identicalErrors.length >= 3) {
        logger.error('Detected repeated identical errors, blocking task', {
          task_id: task.task_id,
          error_message: errorMsg,
          occurrences: identicalErrors.length,
          iterations_affected: identicalErrors.map(e => e.iteration)
        });
        
        return {
          shouldRetry: false,
          reason: `Repeated identical error (${identicalErrors.length}x): ${errorMsg}`,
          action: 'block'
        };
      }
      
      // Record this attempt
      history.push({
        iteration: currentIteration,
        error_message: errorMsg,
        timestamp: Date.now()
      });
      this.attemptHistory.set(task.task_id, history);
    }
    
    // Check iteration count
    const maxIterations = task.retry_policy?.max_retries || 3;
    if (currentIteration >= maxIterations) {
      return {
        shouldRetry: false,
        reason: `Max iterations reached (${currentIteration}/${maxIterations})`,
        action: 'block'
      };
    }
    
    return { shouldRetry: true, reason: 'Retry allowed' };
  }
}
```

#### 4.2 CLI Error Detection

**Location**: `src/infrastructure/cli/cli-adapter.ts`

```typescript
export async function executeCLICommand(
  command: string,
  agentMode: string
): Promise<CLIResult> {
  const result = await executeCommand(command);
  
  // Detect invalid model error specifically
  const invalidModelPattern = /error: option '--model <model>' argument '([^']+)' is invalid/;
  const match = result.stderr.match(invalidModelPattern);
  
  if (match) {
    const invalidModel = match[1];
    throw new InvalidModelError(
      `Model "${invalidModel}" is not supported by CLI. Valid choices: ${VALID_MODELS.join(', ')}`,
      { invalidModel, validModels: VALID_MODELS }
    );
  }
  
  return result;
}
```

## Implementation Plan

### Phase 1: Immediate Fixes (1)

**Priority**: Prevent infinite loops

- [ ] **1.1**: Add model name validation on task enqueue
  - Location: `src/application/use-cases/enqueue-task.usecase.ts`
  - Impact: Validates basic task structure (future: provider-specific model validation)
  - Testing: Enqueue task with valid structure, expect acceptance

- [ ] **1.2**: Add repeated error detection to retry logic
  - Location: `src/domain/services/retry-manager.service.ts`
  - Impact: Blocks tasks after 3 identical errors
  - Testing: Create task that fails CLI execution, verify blocks after 3 attempts

- [ ] **1.3**: Improve JSON parsing with markdown stripping
  - Location: `src/infrastructure/cli/interrogation-parser.ts`
  - Impact: Handles agent markdown wrapping gracefully
  - Testing: Parse `"```json\n{...}\n```"` format, verify extraction

### Phase 2: Task Type Support (2)

**Priority**: Enable behavioral validation

- [ ] **2.1**: Add `task_type` field to schema and domain model
  - Locations: `TASK_SCHEMA.json`, `src/domain/entities/task.entity.ts`
  - Impact: Explicit task type annotation
  - Testing: Enqueue task with `task_type: "behavioral"`, verify accepted

- [ ] **2.2**: Implement behavioral validator
  - Location: `src/domain/validators/behavioral-validator.ts`
  - Impact: Validates conversational responses without file checks
  - Testing: Validate "Greet" criterion against "Hello" response, expect pass

- [ ] **2.3**: Add task-type-aware validation router
  - Location: `src/domain/validators/validator.service.ts`
  - Impact: Routes to appropriate validator based on task type
  - Testing: Validate behavioral task, verify no file checks run

### Phase 3: Interrogation Improvements (3)

**Priority**: Reduce false negatives

- [ ] **3.1**: Skip interrogation for behavioral tasks
  - Location: `src/application/use-cases/validate-output.usecase.ts`
  - Impact: Avoids pointless file searches for conversational tasks
  - Testing: Behavioral task fails validation, verify no interrogation triggered

- [ ] **3.2**: Add task type detection logic
  - Location: `src/domain/services/task-analyzer.service.ts`
  - Impact: Auto-detects task type for legacy tasks
  - Testing: Task with "greet" in criteria detects as 'behavioral'

### Phase 4: Documentation & Migration (4)

**Priority**: Operator guidance

- [ ] **4.1**: Update task schema documentation
  - Location: `docs/TASK_SCHEMA.md`
  - Content: Document `task_type` field, behavioral validation, examples

- [ ] **4.2**: Create migration guide for existing tasks
  - Location: `docs/MIGRATION_BEHAVIORAL_TASKS.md`
  - Content: How to convert problematic tasks like testing-0091

- [ ] **4.3**: Add validation examples to VALIDATION.md
  - Location: `docs/VALIDATION.md`
  - Content: Behavioral validation rules, examples, limitations

## Testing Strategy

### Unit Tests

```typescript
describe('BehavioralValidator', () => {
  it('should pass "Greet" criterion when response contains greeting', async () => {
    const validator = new BehavioralValidator();
    const result = await validator.validate(
      'Greet',
      'Hello! How can I help you today?'
    );
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe('HIGH');
  });
  
  it('should pass "Respond concisely" when word count < 50', async () => {
    const validator = new BehavioralValidator();
    const result = await validator.validate(
      'Respond concisely',
      'This is a short response.'
    );
    expect(result.passed).toBe(true);
  });
});

describe('RetryManager', () => {
  it('should block after 3 identical errors', () => {
    const manager = new RetryManager();
    const error = new Error('invalid model');
    
    // First 3 attempts
    for (let i = 0; i < 3; i++) {
      const decision = manager.shouldRetry(mockTask, i, error);
      expect(decision.shouldRetry).toBe(true);
    }
    
    // 4th attempt should block
    const decision = manager.shouldRetry(mockTask, 3, error);
    expect(decision.shouldRetry).toBe(false);
    expect(decision.action).toBe('block');
  });
});
```

### Integration Tests

```typescript
describe('Behavioral Task End-to-End', () => {
  it('should complete behavioral task without file checks', async () => {
    const task: Task = {
      task_id: 'behavioral-001',
      task_type: 'behavioral',
      intent: 'Test conversational response',
      instructions: 'Say hello',
      acceptance_criteria: ['Greet', 'Respond concisely'],
      working_directory: 'sandbox'
    };
    
    // Enqueue
    await supervisorService.enqueueTask(task);
    
    // Execute (mock agent returns "Hello!")
    await supervisorService.processNextTask();
    
    // Verify
    const state = await supervisorService.getState();
    const completedTask = state.completed_tasks.find(t => t.task_id === 'behavioral-001');
    expect(completedTask).toBeDefined();
    expect(completedTask.validation_report.all_passed).toBe(true);
  });
});
```

## Workaround for Existing Task testing-0091

**Immediate Action** (until fixes deployed):

```bash
# 1. Remove stuck task from queue
redis-cli -h localhost -p 6499 LREM supervisor:queue 0 testing-0091

# 2. Remove task state
redis-cli -h localhost -p 6499 DEL "supervisor:task:testing-0091"

# 3. Enqueue properly structured task
cat > /tmp/behavioral-task.json <<'EOF'
{
  "task_id": "behavioral-002",
  "task_type": "behavioral",
  "intent": "Test conversational greeting",
  "instructions": "Provide a friendly greeting and introduce yourself as a coding assistant.",
  "acceptance_criteria": [
    "Response contains greeting (hello, hi, or welcome)",
    "Response is under 100 words",
    "Response mentions assistant capabilities"
  ],
  "working_directory": "sandbox/easeclassifieds",
  "retry_policy": {
    "max_retries": 2
  }
}
EOF

npx ts-node scripts/enqueue-task.ts /tmp/behavioral-task.json
```

**Note**: `agent_mode` field can be used as needed for specific provider/model selection. Set to `"auto"` or omit for automatic selection. The issue with testing-0091 was the specific model name `"gemini-2.5-flash-lite"` being invalid for that CLI.

## Success Metrics

### Before Implementation (Baseline)
- Task testing-0091: 87+ iterations, 0% completion
- Repeated errors: 100% (every attempt fails with invalid model)
- False interrogations: 3 criteria × 4 questions = 12 wasted rounds
- Resource waste: ~890KB prompt logs, ~25K tokens/iteration

### After Implementation (Target)
- Behavioral tasks: Complete in 1 iteration
- Invalid model rejection: 100% caught at enqueue
- Interrogation skip rate: 100% for behavioral tasks
- Repeated error blocking: Activate after 3 identical failures

### KPIs
- **Average iterations for behavioral tasks**: < 2 (vs. 87+ currently)
- **Invalid task rejection rate**: 100% at enqueue
- **False interrogation rate**: 0% for behavioral tasks
- **Operator intervention required**: 0% (automated blocking)

## Relationship to SUPERVISOR_AGENT_IMPROVEMENTS.md

This plan is **complementary** to SUPERVISOR_AGENT_IMPROVEMENTS.md:

- **SUPERVISOR_AGENT_IMPROVEMENTS.md** (macro-level): System-wide efficiency, multi-phase roadmap, AST validation, caching, analytics
- **This plan** (micro-level): Specific architectural gap fix, behavioral validation, escape mechanisms

**Integration Point**: This plan's behavioral validation can be referenced in SUPERVISOR_AGENT_IMPROVEMENTS Phase 3 under "Enhanced Validation with Code Analysis" as a specialized validator type.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Behavioral validation too lenient (false positives) | Tasks marked complete when criteria not truly met | Start conservative (strict patterns), tune based on feedback |
| Task type detection misclassifies tasks | Wrong validator applied | Allow explicit `task_type` override, log detection decisions |
| Breaking change to task schema | Existing tasks fail validation | Make `task_type` optional, default to 'coding', implement graceful fallback |
| Repeated error blocking too aggressive | Valid retries blocked prematurely | Set threshold to 3+ identical errors, add operator override mechanism |

## Conclusion

The validation loop issue stems from a fundamental mismatch: file-based validation system vs. behavioral task requirements. By adding task type awareness, behavioral validation support, and robust escape mechanisms, we enable the supervisor to handle conversational/behavioral tasks correctly while preventing infinite retry loops.

**Immediate Action Required**: Implement Phase 1 (model validation + repeated error detection) to prevent resource waste on stuck tasks like testing-0091.

**Long-term Value**: Expands supervisor capabilities to handle diverse task types beyond code generation, enabling use cases like testing agent personality, validating conversational flows, and documenting behavioral requirements.
