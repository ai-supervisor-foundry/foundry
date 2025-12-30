# Enhanced Prompt and Response Logging

## Overview

The supervisor now logs full prompts and agent responses to a dedicated log file, while audit logs include previews for quick reference. This provides comprehensive visibility into supervisor-agent communication for debugging and analysis.

## Directory Structure

```
sandbox/
  <project_id>/
    audit.log.jsonl          # Enhanced with prompt/response previews
    logs/
      prompts.log.jsonl       # Full prompts and responses (JSONL format)
```

## Log Files

### Audit Log (`audit.log.jsonl`)

The audit log continues to track state changes and validation results, now enhanced with:

- `prompt_preview`: First 500 characters of the prompt
- `response_preview`: First 500 characters of the response
- `prompt_length`: Full length of the prompt
- `response_length`: Full length of the response

**Location**: `sandbox/<project_id>/audit.log.jsonl`

**Format**: One JSON object per line (JSONL)

**Example Entry**:
```json
{
  "timestamp": "2025-12-28T09:30:39.290Z",
  "iteration": 1,
  "event": "TASK_COMPLETED",
  "task_id": "project-001",
  "tool_invoked": "cursor-cli",
  "state_diff": {...},
  "validation_summary": {...},
  "prompt_preview": "## Task ID\nproject-001\n\n## Task Description\n...",
  "response_preview": "I have implemented the following changes...",
  "prompt_length": 1727,
  "response_length": 5432
}
```

### Prompts Log (`logs/prompts.log.jsonl`)

The prompts log contains full prompts and responses for all interactions:

- Full prompt content (truncated if >100KB)
- Full response content (truncated if >100KB)
- Metadata (agent mode, working directory, durations, etc.)

**Location**: `sandbox/<project_id>/logs/prompts.log.jsonl`

**Format**: One JSON object per line (JSONL)

**Entry Types**:
- `PROMPT`: Initial task prompt
- `RESPONSE`: Agent response to initial prompt
- `FIX_PROMPT`: Fix prompt for validation failures
- `CLARIFICATION_PROMPT`: Clarification prompt for ambiguity/questions
- `INTERROGATION_PROMPT`: Interrogation question for failed criteria
- `INTERROGATION_RESPONSE`: Agent response to interrogation question

**Example Entry**:
```json
{
  "timestamp": "2025-12-28T09:30:39.290Z",
  "task_id": "project-001",
  "iteration": 1,
  "type": "PROMPT",
  "content": "## Task ID\nproject-001\n\n## Task Description\n...",
  "metadata": {
    "agent_mode": "auto",
    "working_directory": "./sandbox/easeclassifieds",
    "prompt_length": 1727,
    "intent": "Set up frontend project"
  }
}
```

## Log Entry Fields

### Common Fields

- `timestamp`: ISO 8601 timestamp
- `task_id`: Task identifier
- `iteration`: Control loop iteration number (0 for interrogation)
- `type`: Entry type (see above)
- `content`: Full prompt/response content
- `metadata`: Additional context (varies by type)

### Metadata Fields (by Type)

**PROMPT/RESPONSE**:
- `agent_mode`: Agent mode used (e.g., "auto", "opus-4.5")
- `working_directory`: Working directory for execution
- `prompt_length` / `response_length`: Content length
- `intent`: Task intent
- `stdout_length`, `stderr_length`: For responses
- `exit_code`: For responses
- `duration_ms`: Execution duration

**FIX_PROMPT/CLARIFICATION_PROMPT**:
- All PROMPT fields plus:
- `prompt_type`: "fix" or "clarification"
- `retry_count`: Retry attempt number

**INTERROGATION_PROMPT/INTERROGATION_RESPONSE**:
- All PROMPT/RESPONSE fields plus:
- `criterion`: Acceptance criterion being interrogated
- `question_number`: Question number (1-4)
- `analysis_result`: For responses - "COMPLETE", "INCOMPLETE", or "UNCERTAIN"

## Truncation Behavior

Content larger than 100KB is truncated:
- First 100KB is kept
- Truncation note appended: `\n\n[TRUNCATED: ${originalLength} bytes total]`
- Metadata includes: `truncated: true, original_length: number`

## Reading Logs

### Using Command Line Tools

**View audit log**:
```bash
cat sandbox/<project_id>/audit.log.jsonl | jq .
```

**View prompts log**:
```bash
cat sandbox/<project_id>/logs/prompts.log.jsonl | jq .
```

**Filter by task**:
```bash
cat sandbox/<project_id>/logs/prompts.log.jsonl | jq 'select(.task_id == "project-001")'
```

**Filter by type**:
```bash
cat sandbox/<project_id>/logs/prompts.log.jsonl | jq 'select(.type == "PROMPT")'
```

**Get all prompts for a task**:
```bash
cat sandbox/<project_id>/logs/prompts.log.jsonl | jq 'select(.task_id == "project-001" and .type == "PROMPT")'
```

**Get all responses for a task**:
```bash
cat sandbox/<project_id>/logs/prompts.log.jsonl | jq 'select(.task_id == "project-001" and .type == "RESPONSE")'
```

### Using Programming Languages

**Python**:
```python
import json

with open('sandbox/<project_id>/logs/prompts.log.jsonl', 'r') as f:
    for line in f:
        entry = json.loads(line)
        print(f"{entry['type']}: {entry['task_id']}")
```

**Node.js**:
```javascript
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('sandbox/<project_id>/logs/prompts.log.jsonl')
});

rl.on('line', (line) => {
  const entry = JSON.parse(line);
  console.log(`${entry.type}: ${entry.task_id}`);
});
```

## Relationship Between Logs

- **Audit log**: High-level events, state changes, validation results, previews
- **Prompts log**: Detailed communication history, full content

Use audit log for:
- Quick overview of task execution
- State transitions
- Validation summaries
- Finding specific events

Use prompts log for:
- Debugging agent behavior
- Understanding full context of interactions
- Analyzing prompt construction
- Reviewing agent responses in detail

## Error Handling

Logging failures are non-blocking:
- If log directory creation fails: Error logged, execution continues
- If log write fails: Error logged, execution continues
- Supervisor never halts due to logging issues

## Performance Considerations

- Logging is asynchronous and non-blocking
- Large content (>100KB) is truncated to prevent log bloat
- JSONL format allows streaming and efficient parsing
- Logs are append-only, no locking required

## Maintenance

- Logs are append-only and never modified
- Old logs can be archived or deleted manually
- Consider log rotation for long-running supervisors
- Monitor disk space usage for large projects

