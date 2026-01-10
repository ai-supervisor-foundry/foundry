# Behavioral Tasks Guide

## What Are Behavioral Tasks?

- Conversational/interactive tasks with no file artifacts
- Focus on agent response quality, not code changes
- Examples: "Greet the user", "Explain the system", "Answer questions"
- NOT suitable for: code generation, file creation, refactoring

## When to Use Behavioral Tasks

### ✅ Good Use Cases
- Agent personality testing ("Greet concisely", "Be professional")
- Conversational validation ("Respond to 3 questions")
- Documentation verification ("Explain the architecture")
- System knowledge probing ("Who maintains this?")
- Training/behavior verification ("Are you hallucinating?")

### ❌ Bad Use Cases
- Feature implementation ("Build a login form")
- Bug fixes ("Fix the null pointer exception")
- File modifications ("Update README")
- Code generation ("Create a service class")
- Anything producing file artifacts

## Creating Behavioral Tasks

### Task Definition

```json
{
  "task_id": "behavioral-greet-test",
  "task_type": "behavioral",
  "intent": "Test agent greeting",
  "instructions": "Provide a friendly greeting and introduce your capabilities.",
  "acceptance_criteria": [
    "Greet using hello/hi/welcome",
    "Response under 100 words",
    "Mention you are an AI assistant"
  ],
  "working_directory": "sandbox/easeclassifieds",
  "retry_policy": {
    "max_retries": 1
  }
}
```

### Task Type Field

**Field**: `task_type` (optional, string enum)

**Valid Values**:
- `"behavioral"` - Conversational, no files
- `"coding"` - Implementation, file-based (default if omitted)
- `"configuration"` - Setup/installation
- `"testing"` - Test execution
- `"documentation"` - Writing docs

**Default**: If omitted, auto-detects from intent/instructions keywords

### Auto-Detection

The system auto-detects task type based on keywords:

| Type | Detection Keywords |
|------|-------------------|
| behavioral | greet, hello, say, respond, explain, who are you |
| testing | test, spec, assertion, coverage, verify |
| configuration | configure, setup, environment, install, deploy |
| documentation | document, readme, write.*doc, guide |
| coding | (default) |

**Note**: Explicit `task_type` field always overrides auto-detection.

## Behavioral Validation Rules

### Available Criteria Patterns

| Criterion | Validation Method | Passes When |
|-----------|------------------|------------|
| "Greet" | Response text regex | Contains: hello, hi, welcome, greetings, hey |
| "Respond concisely" | Word count | Response ≤ 300 words (configurable) |
| "Respond separately per message" | Line count | Response has ≥ 2 separate paragraphs |
| Custom pattern | Regex match | Response matches provided regex pattern |

### Confidence Levels

- **HIGH**: Pattern found with clear evidence
- **MEDIUM**: Inferred from context (e.g., multiple greeting synonyms)
- **LOW**: Uncertain, requires interrogation (not applicable for behavioral tasks)
- **UNCERTAIN**: Missing evidence, interrogation attempted (behavioral tasks skip this)

**Behavioral Advantage**: No UNCERTAIN → no interrogation needed

## Interrogation Bypass

### Why Behavioral Tasks Skip Interrogation

Interrogation asks: "Where is the file that implements this?"

For behavioral tasks:
- ❌ No files to find (response is the implementation)
- ❌ No code paths to trace
- ❌ No git diffs to analyze

Therefore: **Behavioral tasks skip interrogation entirely**

### Control Flow

```
Task Validation
  ├─ If task_type === 'behavioral'
  │  ├─ Run behavioral validator
  │  ├─ Report: PASSED or FAILED (no interrogation)
  │  └─ Move to next iteration or success
  │
  └─ If task_type !== 'behavioral'
     ├─ Run file-based validator
     └─ If confidence is LOW/UNCERTAIN
        └─ Interrogate: "Where is the implementation?"
```

## Common Pitfalls & Solutions

### ❌ Pitfall 1: Using File-Based Task for Behavioral Criteria

**Problem**:
```json
{
  "task_type": "coding",
  "acceptance_criteria": ["Greet"]
}
```

**Result**: System searches codebase for "Greet" keyword, fails when not found

**Solution**: Set `task_type: "behavioral"`

```json
{
  "task_type": "behavioral",
  "acceptance_criteria": ["Greet"]
}
```

### ❌ Pitfall 2: Invalid Model Names

**Problem**:
```json
{
  "agent_mode": "gemini-2.5-flash-lite"
}
```

**Error**: `option '--model <model>' argument 'gemini-2.5-flash-lite' is invalid`

**Valid Models**: claude-sonnet-4.5, claude-haiku-4.5, gemini-3-pro-preview, gpt-5.1, etc.

**Solution**: Use valid model name or omit field for auto-selection

### ❌ Pitfall 3: Vague Acceptance Criteria

**Problem**:
```json
{
  "acceptance_criteria": ["Be helpful"]
}
```

**Why It Fails**: "Helpful" doesn't match any recognized pattern

**Solution**: Use specific, pattern-matching criteria

```json
{
  "acceptance_criteria": [
    "Greet with hello/hi/welcome",
    "Respond concisely in under 100 words",
    "Answer at least 2 questions"
  ]
}
```

### ❌ Pitfall 4: Too Many Acceptance Criteria

**Problem**: 10+ criteria for a single response

**Why It Fails**: Agent can't meet all in one response without instruction tuning

**Solution**: Limit to 3-5 clear, achievable criteria

### ❌ Pitfall 5: Expecting Unlimited Retries

**Problem**: Setting `max_retries: 10` expecting thorough debugging

**Why It Fails**: System defaults to 1 retry (fast-fail strategy). Higher values waste resources on hopeless tasks.

**Solution**: Use max_retries: 1, rely on repeated error blocking (3 consecutive identical errors → task blocked)

**Note**: Interrogation is limited to 1 round per criterion (initial) and 0 rounds (final) for faster convergence.

## Examples

### Example 1: Greeting Test

```json
{
  "task_id": "behavioral-greet-001",
  "task_type": "behavioral",
  "intent": "Verify agent can greet politely",
  "instructions": "Say hello and briefly introduce yourself as a coding assistant.",
  "acceptance_criteria": [
    "Greet using hello, hi, or welcome",
    "Respond concisely (under 50 words)",
    "Mention being an AI assistant"
  ],
  "working_directory": "sandbox",
  "retry_policy": { "max_retries": 1 }
}
```

**Expected Response**: 
```
Hello! I'm a coding assistant here to help with your questions. What would you like to know?
```

**Validation**: ✅ PASS
- Contains "Hello" (greeting)
- 15 words (concise)
- Mentions "coding assistant" (AI role)

### Example 2: Explanation Test

```json
{
  "task_id": "behavioral-explain-001",
  "task_type": "behavioral",
  "intent": "Verify agent understands system architecture",
  "instructions": "Explain the supervisor validation system in 3-4 sentences.",
  "acceptance_criteria": [
    "Explains validation routing",
    "Mentions task types (behavioral, coding)",
    "Respond concisely (under 200 words)"
  ],
  "working_directory": "sandbox",
  "retry_policy": { "max_retries": 1 }
}
```

**Expected Response**:
```
The supervisor validates tasks using a dual-track system. Behavioral tasks check response content (greetings, conciseness) without file verification. Coding tasks search the codebase for implementation evidence. Tasks are routed based on their type, allowing specialized validation rules for each category.
```

**Validation**: ✅ PASS
- Explains routing (validation routing check)
- Mentions behavioral/coding types
- 67 words (concise)

## Troubleshooting

### Issue: "No matches found" during interrogation

**Cause**: Behavioral task was marked as `task_type: "coding"`

**Solution**: Change `task_type: "behavioral"`

### Issue: Invalid model error persists

**Cause**: Model name not in allowed list

**Solution**: Use `--allow-all-models` flag or verify model support

### Issue: Behavioral task keeps failing with vague criteria

**Cause**: Criteria like "Be helpful" don't match regex patterns

**Solution**: Use specific patterns: "Greet", "Respond concisely", "Answer questions"

## Integration with Supervisor

### Running Behavioral Tasks

```bash
# Via CLI
npx ts-node scripts/enqueue-task.ts behavioral-task.json

# Via Redis
redis-cli -h localhost -p 6499 LPUSH supervisor:queue '{"task_id":"behavioral-001","task_type":"behavioral",...}'
```

### Monitoring

```bash
# Watch task progress (skips interrogation)
npx ts-node scripts/dump-state.ts | jq '.current_task'

# Check validation results
npx ts-node scripts/dump-state.ts | jq '.validation_report'
```

### Success Indicators

- ✅ Task enters validation phase immediately
- ✅ No interrogation prompts generated
- ✅ Validation completes within 1-2 iterations
- ✅ Behavioral criteria all pass/fail quickly

## Related Documentation

- [VALIDATION.md](../VALIDATION.md) - Validation system details
- [ARCHITECTURE_DETAILED.md](../ARCHITECTURE_DETAILED.md) - Control loop design
- [TASK_SCHEMA.json](../../TASK_SCHEMA.json) - Task definition schema
