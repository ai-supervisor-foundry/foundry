# Supervisor-Agent Interaction Improvements

## Executive Summary

After analyzing 1,221+ prompt log entries and the current implementation, this document proposes improvements to make supervisor-agent interaction more efficient, powerful, and reliable while maintaining the core principles of determinism, auditability, and operator control.

## Current State Analysis

### Strengths
1. **Comprehensive Logging**: Full prompt/response logging enables debugging
2. **Multi-Phase Validation**: Helper Agent → Interrogation → Fix prompts provide layered validation
3. **Batched Interrogation**: Efficiently handles multiple failed criteria
4. **Deterministic Control**: Clear separation between supervisor logic and agent execution

### Observed Issues
1. **High Iteration Counts**: Tasks often require 100+ iterations (e.g., iter:115, iter:112)
2. **"Already Complete" Pattern**: Many tasks report "already implemented" - suggests validation may be too lenient or agent is checking existing code rather than implementing
3. **Helper Agent Over-Optimism**: Helper Agent frequently returns `isValid: true` without verification commands, potentially missing edge cases
4. **Context Bloat**: Minimal state includes all context regardless of relevance to current task
5. **Validation Keyword Matching**: Current keyword-based validation may be too flexible (false positives) or too strict (false negatives)
6. **Interrogation Rounds**: Even with batching, 4 rounds of interrogation can be slow

## Proposed Improvements

### 1. Smart Context Injection

**Problem**: Current minimal state includes all context (goal, project, queue) regardless of task relevance.

**Solution**: Task-aware context selection

```typescript
interface TaskContext {
  // Always included
  project: { id: string; sandbox_root: string };
  
  // Conditionally included based on task
  goal?: { id: string; description: string }; // Only for goal-related tasks
  queue?: { last_task_id?: string }; // Only if task references previous tasks
  completed_tasks?: Array<{ task_id: string; completed_at: string }>; // Only if task needs to reference previous work
  blocked_tasks?: Array<{ task_id: string; reason: string }>; // Only if task might unblock something
}

function buildTaskAwareContext(
  task: Task,
  state: SupervisorState
): TaskContext {
  const context: TaskContext = {
    project: {
      id: state.goal.project_id,
      sandbox_root: state.project?.sandbox_root || `sandbox/${state.goal.project_id}`,
    },
  };
  
  // Include goal only if task instructions mention "goal" or task intent suggests goal awareness
  if (task.instructions.toLowerCase().includes('goal') || 
      task.intent.toLowerCase().includes('goal') ||
      task.task_id.startsWith('goal-')) {
    context.goal = {
      id: state.goal.id,
      description: state.goal.description,
    };
  }
  
  // Include queue info only if task references previous tasks
  if (task.instructions.toLowerCase().includes('previous') ||
      task.instructions.toLowerCase().includes('last task') ||
      task.instructions.toLowerCase().includes('earlier')) {
    context.queue = {
      last_task_id: state.queue?.last_task_id,
    };
  }
  
  // Include completed tasks only if task needs to build upon previous work
  if (task.instructions.toLowerCase().includes('extend') ||
      task.instructions.toLowerCase().includes('build on') ||
      task.instructions.toLowerCase().includes('previous implementation')) {
    context.completed_tasks = state.completed_tasks?.slice(-5); // Last 5 only
  }
  
  return context;
}
```

**Benefits**:
- Reduces prompt size by 30-50% for most tasks
- Faster agent processing
- Lower token costs
- More focused agent attention

### 2. Enhanced Validation with Code Analysis

**Problem**: Keyword-based validation can miss nuanced implementations or create false positives.

**Solution**: Multi-layer validation with AST analysis for critical checks

```typescript
interface EnhancedValidationRule {
  type: 'keyword' | 'ast' | 'file_structure' | 'test_execution' | 'api_contract';
  criterion: string;
  config: {
    // For AST: parse code and check for specific patterns
    ast_patterns?: Array<{
      node_type: string; // 'FunctionDeclaration', 'ClassDeclaration', etc.
      name_pattern?: RegExp;
      decorator_pattern?: RegExp; // For NestJS: @Get, @Post, etc.
      property_pattern?: RegExp;
    }>;
    // For API contracts: check endpoint definitions
    endpoint_check?: {
      method: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
      path_pattern: RegExp;
      required_decorators?: string[]; // ['@UseGuards(AuthGuard)']
    };
    // For file structure: check directory/file existence
    file_structure?: {
      required_files: string[];
      required_directories: string[];
    };
  };
}

async function validateWithAST(
  criterion: string,
  codeFiles: string[],
  sandboxRoot: string
): Promise<{ satisfied: boolean; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; evidence: string[] }> {
  // Use TypeScript compiler API or Babel parser for AST analysis
  // Check for specific patterns like:
  // - Function/class definitions matching criterion keywords
  // - Decorator patterns for NestJS endpoints
  // - Import statements indicating feature usage
  // - Type definitions matching expected interfaces
  
  // Return structured evidence for each check
}
```

**Benefits**:
- More accurate validation (fewer false positives/negatives)
- Better evidence collection for interrogation
- Can catch subtle implementation issues

### 3. Proactive Helper Agent

**Problem**: Helper Agent often returns `isValid: true` without thorough verification.

**Solution**: Enhanced Helper Agent prompt with explicit verification requirements

```typescript
function buildEnhancedHelperAgentPrompt(
  agentResponse: string,
  failedCriteria: string[],
  sandboxCwd: string,
  codeFiles: string[] // Pre-discovered code files
): string {
  return `
## Enhanced Verification Task

You are a Helper Agent with access to the codebase. Your task is to VERIFY, not assume.

**Context:**
- Working Directory: ${sandboxCwd}
- Available Code Files: ${codeFiles.slice(0, 20).join(', ')}${codeFiles.length > 20 ? '...' : ''}
- Agent Response: ${agentResponse.substring(0, 2000)}

**Failed Criteria:**
${failedCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

**Your Task:**
For EACH criterion, you MUST:
1. **Read the actual code files** mentioned in the agent response (if any)
2. **Search the codebase** for implementation evidence
3. **Verify file existence** and content
4. **Check for specific patterns** (endpoints, functions, classes, etc.)

**Verification Rules:**
- ❌ DO NOT assume based on agent's description alone
- ✅ DO verify by checking actual code files
- ✅ DO generate verification commands if uncertain
- ✅ DO mark isValid=true ONLY if you can verify in code

**Output Format:**
\`\`\`json
{
  "isValid": boolean,
  "verificationCommands": string[],
  "reasoning": "For each criterion: [Criterion] - [Verification result]",
  "criterionResults": {
    "[criterion]": {
      "verified": boolean,
      "evidence": string[],
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  }
}
\`\`\`
`;
}
```

**Benefits**:
- More thorough verification
- Better evidence collection
- Reduced false positives
- Clearer reasoning for each criterion

### 4. Targeted Interrogation with Pre-Analysis

**Problem**: Interrogation starts from scratch without leveraging validation evidence.

**Solution**: Pre-analyze codebase before interrogation to ask targeted questions

```typescript
async function preAnalyzeForInterrogation(
  failedCriteria: string[],
  sandboxCwd: string,
  codeFiles: string[]
): Promise<InterrogationContext> {
  // Before asking agent, analyze codebase:
  // 1. Search for relevant files based on criterion keywords
  // 2. Extract potential implementation locations
  // 3. Identify missing patterns
  
  const context: InterrogationContext = {
    potentialLocations: {}, // criterion -> [file paths]
    missingPatterns: {}, // criterion -> [expected patterns not found]
    relatedFiles: {}, // criterion -> [related files that might contain implementation]
  };
  
  for (const criterion of failedCriteria) {
    // Search codebase for criterion-related files
    const relevantFiles = await searchCodebaseForCriterion(criterion, codeFiles, sandboxCwd);
    context.potentialLocations[criterion] = relevantFiles;
    
    // Identify what patterns we expect but don't see
    const expectedPatterns = extractExpectedPatterns(criterion);
    const missingPatterns = await checkForMissingPatterns(expectedPatterns, relevantFiles);
    context.missingPatterns[criterion] = missingPatterns;
  }
  
  return context;
}

async function buildTargetedInterrogationPrompt(
  task: Task,
  criteria: string[],
  interrogationContext: InterrogationContext,
  questionNumber: number,
  maxQuestions: number,
  minimalState: MinimalState
): Promise<string> {
  return `
## Targeted Interrogation Request

**Criteria to clarify:**
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

**Pre-Analysis Results:**
${criteria.map(c => {
  const locations = interrogationContext.potentialLocations[c] || [];
  const missing = interrogationContext.missingPatterns[c] || [];
  return `
**Criterion: ${c}**
- Potential locations found: ${locations.length > 0 ? locations.join(', ') : 'None'}
- Missing patterns: ${missing.length > 0 ? missing.join(', ') : 'None'}
`;
}).join('\n')}

**Question ${questionNumber} of ${maxQuestions}:**
Based on the pre-analysis above, please:
1. Confirm if the potential locations contain the implementation
2. If not, specify the exact file path(s) where this is implemented
3. If not implemented, state so explicitly

**Working directory:** ${minimalState.project.sandbox_root}
`;
}
```

**Benefits**:
- More targeted questions (faster resolution)
- Leverages validation evidence
- Reduces interrogation rounds
- Better agent responses (agent sees what we found)

### 5. Incremental Validation Feedback

**Problem**: Agent only sees validation results after full validation completes.

**Solution**: Provide incremental feedback during task execution

```typescript
interface IncrementalValidationResult {
  criterion: string;
  status: 'PASSING' | 'FAILING' | 'UNCERTAIN';
  evidence: string[];
  suggestions?: string[]; // Hints for fixing
}

async function validateIncrementally(
  task: Task,
  agentResponse: string,
  sandboxRoot: string
): Promise<IncrementalValidationResult[]> {
  // Run quick validation checks as agent works
  // Return results immediately for criteria that can be checked quickly
  // This allows agent to self-correct during implementation
}
```

**Note**: This requires agent to support mid-task feedback, which may not be compatible with current Cursor CLI model. Consider as future enhancement.

### 6. Validation Confidence Scoring

**Problem**: Binary pass/fail doesn't capture nuance.

**Solution**: Confidence scoring with thresholds

```typescript
interface ValidationConfidence {
  score: number; // 0-100
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  factors: {
    code_evidence: number; // 0-40 points
    test_evidence: number; // 0-30 points
    file_structure: number; // 0-20 points
    agent_assertion: number; // 0-10 points (lowest weight)
  };
  threshold: {
    pass: number; // e.g., 70
    uncertain: number; // e.g., 50
  };
}

function calculateConfidence(
  criterion: string,
  validationResults: ValidationResult[]
): ValidationConfidence {
  // Score based on multiple factors
  // Higher confidence = more reliable validation
}
```

**Benefits**:
- More nuanced validation decisions
- Better retry logic (retry only if confidence is medium/low)
- Clearer operator feedback

### 7. Contextual Prompt Templates

**Problem**: One-size-fits-all prompt structure may not be optimal for all task types.

**Solution**: Task-type-specific prompt templates

```typescript
type TaskType = 'implementation' | 'configuration' | 'testing' | 'documentation' | 'refactoring';

function buildTaskTypeSpecificPrompt(
  task: Task,
  taskType: TaskType,
  minimalState: MinimalState
): string {
  const basePrompt = buildPrompt(task, minimalState);
  
  switch (taskType) {
    case 'implementation':
      // Emphasize code structure, patterns, best practices
      return addImplementationGuidelines(basePrompt);
    case 'configuration':
      // Emphasize config file locations, environment variables
      return addConfigurationGuidelines(basePrompt);
    case 'testing':
      // Emphasize test structure, coverage, assertions
      return addTestingGuidelines(basePrompt);
    case 'documentation':
      // Emphasize documentation format, completeness
      return addDocumentationGuidelines(basePrompt);
    case 'refactoring':
      // Emphasize preserving functionality, incremental changes
      return addRefactoringGuidelines(basePrompt);
  }
}

function detectTaskType(task: Task): TaskType {
  // Analyze task instructions and intent to determine type
  const lowerInstructions = task.instructions.toLowerCase();
  const lowerIntent = task.intent.toLowerCase();
  
  if (lowerInstructions.includes('test') || lowerIntent.includes('test')) {
    return 'testing';
  }
  if (lowerInstructions.includes('config') || lowerInstructions.includes('setup')) {
    return 'configuration';
  }
  if (lowerInstructions.includes('document') || lowerInstructions.includes('readme')) {
    return 'documentation';
  }
  if (lowerInstructions.includes('refactor') || lowerInstructions.includes('improve')) {
    return 'refactoring';
  }
  return 'implementation';
}
```

**Benefits**:
- More relevant guidance for agent
- Better task-specific instructions
- Improved task completion rates

### 8. Smart Retry Strategy

**Problem**: Current retry strategy is linear (fixed max_retries).

**Solution**: Adaptive retry based on validation confidence and error type

```typescript
interface RetryStrategy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'adaptive';
  retryConditions: {
    onValidationFailure: boolean;
    onAmbiguity: boolean;
    onResourceExhaustion: boolean;
  };
  adaptiveRules: {
    // Retry more if confidence is medium (uncertain)
    retryOnMediumConfidence: boolean;
    // Retry less if confidence is low (clearly failed)
    skipRetryOnLowConfidence: boolean;
    // Retry with different approach if same error repeats
    changeApproachOnRepeatedFailure: boolean;
  };
}

function shouldRetry(
  task: Task,
  attempt: number,
  validationReport: ValidationReport,
  previousAttempts: ValidationReport[]
): { shouldRetry: boolean; reason: string; nextApproach?: 'fix' | 'clarification' | 'helper_agent' } {
  // Analyze validation results and previous attempts
  // Decide if retry is worthwhile and what approach to use
}
```

**Benefits**:
- Smarter retry decisions (don't retry hopeless cases)
- Different approaches for different failure types
- Better resource utilization

### 9. Validation Result Caching

**Problem**: Same validation checks run repeatedly across iterations.

**Solution**: Cache validation results for unchanged code

```typescript
interface ValidationCache {
  fileHash: string; // SHA-256 of file content
  criterion: string;
  result: ValidationResult;
  timestamp: number;
  ttl: number; // Time to live
}

class ValidationCacheManager {
  private cache: Map<string, ValidationCache> = new Map();
  
  async getCachedResult(
    criterion: string,
    codeFiles: string[]
  ): Promise<ValidationResult | null> {
    const cacheKey = this.buildCacheKey(criterion, codeFiles);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      // Verify file hasn't changed
      const currentHash = await this.hashFiles(codeFiles);
      if (currentHash === cached.fileHash) {
        return cached.result;
      }
    }
    
    return null;
  }
  
  async setCachedResult(
    criterion: string,
    codeFiles: string[],
    result: ValidationResult
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(criterion, codeFiles);
    const fileHash = await this.hashFiles(codeFiles);
    
    this.cache.set(cacheKey, {
      fileHash,
      criterion,
      result,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000, // 5 minutes
    });
  }
}
```

**Benefits**:
- Faster validation for unchanged code
- Reduced computational overhead
- Better performance on retries

### 10. Enhanced Logging and Analytics

**Problem**: Current logs don't provide insights into efficiency bottlenecks.

**Solution**: Add performance metrics and analytics

```typescript
interface TaskMetrics {
  task_id: string;
  total_iterations: number;
  validation_time_ms: number[];
  interrogation_rounds: number;
  helper_agent_calls: number;
  prompt_size_chars: number;
  response_size_chars: number;
  validation_confidence_scores: number[];
  retry_reasons: string[];
  bottlenecks: {
    phase: 'validation' | 'interrogation' | 'helper_agent' | 'agent_execution';
    duration_ms: number;
    percentage_of_total: number;
  }[];
}

function analyzeTaskMetrics(taskId: string): TaskMetrics {
  // Analyze prompt logs and audit logs to extract metrics
  // Identify bottlenecks
  // Calculate efficiency scores
}
```

**Benefits**:
- Data-driven optimization
- Identify common failure patterns
- Measure improvement impact

## Implementation Status

### Phase 1 (High Impact, Low Risk)
- [x] **Smart Context Injection** - Reduces prompt size, improves efficiency (Implemented Dec 2025)
- [x] **Enhanced Interrogation Logic** - Max 2 rounds, deterministic exits (Implemented Dec 2025)
- [x] **Enhanced Helper Agent Prompt** - Better verification with code discovery (Implemented Dec 2025)
- [x] **Validation Confidence Scoring** - Nuanced decisions with MatchQuality (Implemented Dec 2025)

### Phase 2 (High Impact, Medium Risk)
- [x] **Targeted Interrogation with Pre-Analysis** - Keyword-based file discovery (Implemented Dec 2025)
- [x] **Task-Type-Specific Prompts** - Tailored guidelines for different tasks (Implemented Dec 2025)
- [x] **Smart Retry Strategy** - Repeated error detection and strict mode (Implemented Dec 2025)

## Implementation Priority (Updated)

1. **AST-Based Validation** (Next)
2. **Validation Result Caching**
3. **Enhanced Logging and Analytics**

### Phase 3 (Medium Impact, Higher Risk)
7. **AST-Based Validation** - More accurate but requires parser integration
8. **Validation Result Caching** - Performance optimization
9. **Enhanced Logging and Analytics** - Long-term insights

### Phase 4 (Future Enhancements)
10. **Incremental Validation Feedback** - Requires agent capability changes

## Reliability Considerations

All improvements maintain core principles:
- ✅ **Deterministic Control**: No AI in supervisor logic
- ✅ **Full Auditability**: All interactions logged
- ✅ **Operator Control**: No autonomous goal refinement
- ✅ **State Persistence**: State saved after every step
- ✅ **Explicit Validation**: All criteria must be met

## Testing Strategy

1. **A/B Testing**: Compare old vs. new approach on same task set
2. **Metrics Tracking**: Measure iteration count, validation time, success rate
3. **Regression Testing**: Ensure existing functionality unchanged
4. **Edge Case Testing**: Test with ambiguous tasks, complex criteria

## Success Metrics

- **Iteration Reduction**: Target 30-50% reduction in average iterations per task
- **Validation Accuracy**: Target 95%+ accuracy (fewer false positives/negatives)
- **Interrogation Efficiency**: Target 50% reduction in interrogation rounds
- **Prompt Efficiency**: Target 30-50% reduction in prompt size
- **Task Completion Rate**: Maintain or improve current completion rate

## Conclusion

These improvements focus on making the supervisor-agent interaction more efficient and reliable while maintaining the core principles of determinism, auditability, and operator control. The phased approach allows for incremental implementation with measurable improvements at each stage.




