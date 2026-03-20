import { describe, it, expect } from 'vitest';
import { extractSection, getSupervisorPreview, getAgentResult, getAgentPreview, isJSON, normalizeNewlines } from './chatParsing';

// Real prompt content from sandbox/dummy/logs/prompts.log.jsonl
const REAL_PROMPT = `## Task ID
task-1773967476179

## Task Description
Say hi and tell me something new about today.

## Intent
Greeting

## Acceptance Criteria
- Greeting present.
- information present

## Rules
- Answer the user's question directly and clearly
- Use information from the READ-ONLY CONTEXT to inform your answer

## Output Requirements
Your response MUST end with ONLY this JSON block.`;

describe('extractSection', () => {
  it('extracts Task Description with full text (no truncation at period)', () => {
    const result = extractSection(REAL_PROMPT, 'Task Description');
    expect(result).toBe('Say hi and tell me something new about today.');
  });

  it('extracts Intent', () => {
    expect(extractSection(REAL_PROMPT, 'Intent')).toBe('Greeting');
  });

  it('extracts multi-line section (Acceptance Criteria)', () => {
    const result = extractSection(REAL_PROMPT, 'Acceptance Criteria');
    expect(result).toContain('Greeting present.');
    expect(result).toContain('information present');
  });

  it('extracts Rules section with multiple lines', () => {
    const result = extractSection(REAL_PROMPT, 'Rules');
    expect(result).toContain('Answer the user');
    expect(result).toContain('READ-ONLY CONTEXT');
  });

  it('returns empty string for missing section', () => {
    expect(extractSection(REAL_PROMPT, 'Nonexistent')).toBe('');
  });

  it('is case-insensitive', () => {
    expect(extractSection(REAL_PROMPT, 'task description')).toBe(
      'Say hi and tell me something new about today.'
    );
  });

  it('handles content with trailing newlines', () => {
    const raw = '## Heading\nSome content\n\n\n## Next';
    expect(extractSection(raw, 'Heading')).toBe('Some content');
  });

  it('handles last section (no trailing ##)', () => {
    const raw = '## Only\nThis is the only section content.';
    expect(extractSection(raw, 'Only')).toBe('This is the only section content.');
  });
});

describe('getSupervisorPreview', () => {
  it('extracts intent and description from real prompt', () => {
    const result = getSupervisorPreview(REAL_PROMPT, {});
    expect(result.intent).toBe('Greeting');
    expect(result.description).toBe('Say hi and tell me something new about today.');
  });

  it('prefers metadata.intent over extracted intent', () => {
    const result = getSupervisorPreview(REAL_PROMPT, { intent: 'Custom Intent' });
    expect(result.intent).toBe('Custom Intent');
    expect(result.description).toBe('Say hi and tell me something new about today.');
  });

  it('falls back to Fix Instructions when no Task Description', () => {
    const fixPrompt = '## Fix Instructions\nPlease fix the greeting.\n\n## Intent\nFix';
    const result = getSupervisorPreview(fixPrompt, {});
    expect(result.description).toBe('Please fix the greeting.');
  });

  it('returns empty description when neither section exists', () => {
    const result = getSupervisorPreview('## Intent\nGreeting', {});
    expect(result.description).toBe('');
  });
});

describe('getAgentResult', () => {
  // --- Known response shapes ---

  it('extracts "result" field (Claude CLI envelope)', () => {
    const raw = JSON.stringify({ type: 'result', subtype: 'success', result: 'Hello! Here is something new.', session_id: 'abc' });
    expect(getAgentResult(raw)).toBe('Hello! Here is something new.');
  });

  it('extracts "response" field (dummy/direct provider)', () => {
    const raw = JSON.stringify({ status: 'completed', response: 'Hello! Hope you\'re having a great day.', confidence: 1.0 });
    expect(getAgentResult(raw)).toBe('Hello! Hope you\'re having a great day.');
  });

  it('extracts "summary" field when result/response absent', () => {
    const raw = JSON.stringify({ status: 'completed', summary: 'Created admin user and verified login.' });
    expect(getAgentResult(raw)).toBe('Created admin user and verified login.');
  });

  it('extracts "output" field when higher-priority fields absent', () => {
    const raw = JSON.stringify({ status: 'done', output: 'Build succeeded.' });
    expect(getAgentResult(raw)).toBe('Build succeeded.');
  });

  it('extracts "message" field as last resort', () => {
    const raw = JSON.stringify({ status: 'error', message: 'Something went wrong.' });
    expect(getAgentResult(raw)).toBe('Something went wrong.');
  });

  it('prefers "result" over "response" when both present', () => {
    const raw = JSON.stringify({ result: 'from result', response: 'from response' });
    expect(getAgentResult(raw)).toBe('from result');
  });

  it('extracts error-type response with result string', () => {
    const raw = JSON.stringify({ type: 'result', subtype: 'error', is_error: true, result: 'Error: command failed' });
    expect(getAgentResult(raw)).toBe('Error: command failed');
  });

  // --- Passthrough / negative cases: unhandled formats render as-is ---

  it('returns raw content if not JSON', () => {
    expect(getAgentResult('plain text response')).toBe('plain text response');
  });

  it('returns raw if JSON but no known text field', () => {
    const raw = JSON.stringify({ status: 'completed', confidence: 1.0 });
    expect(getAgentResult(raw)).toBe(raw);
  });

  it('passes through empty string as-is', () => {
    expect(getAgentResult('')).toBe('');
  });

  it('passes through JSON with result=null (skips to next field)', () => {
    const raw = JSON.stringify({ result: null, response: 'fallback' });
    expect(getAgentResult(raw)).toBe('fallback');
  });

  it('passes through JSON with all text fields null', () => {
    const raw = JSON.stringify({ result: null, response: null });
    expect(getAgentResult(raw)).toBe(raw);
  });

  it('passes through JSON with result=number', () => {
    const raw = JSON.stringify({ result: 42 });
    expect(getAgentResult(raw)).toBe(raw);
  });

  it('passes through JSON with result=object', () => {
    const raw = JSON.stringify({ result: { nested: true } });
    expect(getAgentResult(raw)).toBe(raw);
  });

  it('passes through JSON array', () => {
    const raw = JSON.stringify([1, 2, 3]);
    expect(getAgentResult(raw)).toBe(raw);
  });

  it('passes through truncated / malformed JSON', () => {
    const raw = '{"result": "hello';
    expect(getAgentResult(raw)).toBe(raw);
  });

  it('passes through multiline plain text', () => {
    const raw = 'line1\nline2\nline3';
    expect(getAgentResult(raw)).toBe(raw);
  });

  it('passes through text containing JSON-like braces', () => {
    const raw = 'The config looks like { "key": "val" } in the file';
    expect(getAgentResult(raw)).toBe(raw);
  });

  it('skips empty string fields, falls through to next', () => {
    const raw = JSON.stringify({ result: '', response: 'actual text' });
    expect(getAgentResult(raw)).toBe('actual text');
  });
});

describe('getAgentPreview', () => {
  it('strips trailing json code block from result', () => {
    const raw = JSON.stringify({
      result: 'Hi!\n\n```json\n{\n  "status": "completed",\n  "summary": "Responded to greeting"\n}\n```'
    });
    expect(getAgentPreview(raw)).toBe('Hi!');
  });

  it('returns full text when no trailing json block', () => {
    const raw = JSON.stringify({ result: 'Hello! Here is something new.' });
    expect(getAgentPreview(raw)).toBe('Hello! Here is something new.');
  });

  it('extracts readable field from fenced JSON when result is entirely a code block', () => {
    const raw = JSON.stringify({
      result: '```json\n{"status": "completed", "summary": "Created admin user and verified login.", "reasoning": "Used npm script"}\n```'
    });
    // Extracts summary from the fenced JSON
    expect(getAgentPreview(raw)).toBe('Created admin user and verified login.');
  });

  it('falls back to raw fenced block when no readable field inside', () => {
    const raw = JSON.stringify({
      result: '```json\n{"status": "completed"}\n```'
    });
    expect(getAgentPreview(raw)).toBe('```json\n{"status": "completed"}\n```');
  });

  it('handles non-JSON raw content', () => {
    expect(getAgentPreview('plain text')).toBe('plain text');
  });

  it('extracts "response" field from dummy provider JSON (no code block)', () => {
    const raw = JSON.stringify({
      status: 'completed',
      response: "Hello! Hope you're having a great day. By the way, it's currently sunny.",
      confidence: 1.0
    });
    expect(getAgentPreview(raw)).toBe("Hello! Hope you're having a great day. By the way, it's currently sunny.");
  });

  // --- Negative / edge cases: unhandled formats render as-is ---

  it('passes through empty string', () => {
    expect(getAgentPreview('')).toBe('');
  });

  it('passes through plain multiline text (no JSON wrapper)', () => {
    const raw = 'Created the file.\nUpdated the config.\nDone.';
    expect(getAgentPreview(raw)).toBe(raw);
  });

  it('passes through text with non-trailing code block', () => {
    const raw = JSON.stringify({
      result: '```json\n{"a":1}\n```\n\nThen I did more work.'
    });
    // Code block is NOT trailing, so nothing stripped
    expect(getAgentPreview(raw)).toBe('```json\n{"a":1}\n```\n\nThen I did more work.');
  });

  it('passes through text with non-json code block at end', () => {
    const raw = JSON.stringify({
      result: 'Here is the fix:\n\n```typescript\nconst x = 1;\n```'
    });
    // Only json code blocks get stripped, not typescript
    expect(getAgentPreview(raw)).toBe('Here is the fix:\n\n```typescript\nconst x = 1;\n```');
  });

  it('strips all trailing json code blocks', () => {
    const raw = JSON.stringify({
      result: 'First block:\n```json\n{"a":1}\n```\n\nSecond:\n```json\n{"status":"completed"}\n```'
    });
    // Greedy match removes from first ```json to last ``` — human text before is kept
    expect(getAgentPreview(raw)).toBe('First block:');
  });

  it('extracts summary field when no result/response', () => {
    const raw = JSON.stringify({ status: 'completed', summary: 'done' });
    expect(getAgentPreview(raw)).toBe('done');
  });

  it('passes through JSON with no known text fields as raw string', () => {
    const raw = JSON.stringify({ status: 'completed', confidence: 1.0 });
    expect(getAgentPreview(raw)).toBe(raw);
  });

  it('passes through malformed JSON as-is', () => {
    const raw = '{"result": "hello';
    expect(getAgentPreview(raw)).toBe(raw);
  });

  it('handles result that is only whitespace after stripping', () => {
    const raw = JSON.stringify({
      result: '  \n\n```json\n{"status":"completed"}\n```'
    });
    // Stripped is empty/whitespace, no readable field inside, fallback to trimmed result
    expect(getAgentPreview(raw)).toBe('```json\n{"status":"completed"}\n```');
  });

  it('extracts reasoning from fenced JSON when summary absent', () => {
    const raw = JSON.stringify({
      result: '```json\n{"status": "completed", "reasoning": "Greeting task requires no code changes"}\n```'
    });
    expect(getAgentPreview(raw)).toBe('Greeting task requires no code changes');
  });

  it('handles very long result text without code block', () => {
    const longText = 'A'.repeat(5000);
    const raw = JSON.stringify({ result: longText });
    expect(getAgentPreview(raw)).toBe(longText);
  });
});

describe('isJSON', () => {
  it('returns true for valid JSON', () => {
    expect(isJSON('{"key": "value"}')).toBe(true);
  });
  it('returns false for plain text', () => {
    expect(isJSON('not json')).toBe(false);
  });
});

describe('normalizeNewlines', () => {
  it('collapses multiple newlines to one', () => {
    expect(normalizeNewlines('a\n\n\nb')).toBe('a\nb');
  });
  it('preserves single newlines', () => {
    expect(normalizeNewlines('a\nb')).toBe('a\nb');
  });
});
