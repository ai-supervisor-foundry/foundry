// Pure extraction/parsing helpers for ChatVisualizer
// Extracted for testability — no React dependencies

export function isJSON(str: string): boolean {
  try { JSON.parse(str); return true; } catch { return false; }
}

export function normalizeNewlines(str: string): string {
  return str.replace(/\n{2,}/g, '\n');
}

// Known text fields in agent response JSON, checked in priority order.
// CLI envelope uses "result", direct responses use "response", others may use "summary"/"output"/"message".
const RESULT_TEXT_FIELDS = ['result', 'response', 'summary', 'output', 'message'] as const;

export function getAgentResult(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const field of RESULT_TEXT_FIELDS) {
        if (typeof parsed[field] === 'string' && parsed[field].length > 0) return parsed[field];
      }
    }
  } catch { /* not JSON */ }
  return raw;
}

/**
 * Try to extract a human-readable text field from a JSON string (plain or fenced).
 * Checks known text fields in priority order; skips "result"/"response" since those
 * are the outer envelope fields — here we want inner descriptive fields.
 */
const FENCED_PREVIEW_FIELDS = ['summary', 'reasoning', 'response', 'output', 'message'] as const;

function extractFromFencedJSON(fenced: string): string {
  const match = fenced.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  if (!match) return '';
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const field of FENCED_PREVIEW_FIELDS) {
        if (typeof parsed[field] === 'string' && parsed[field].length > 0) return parsed[field];
      }
    }
  } catch { /* not valid JSON inside fence */ }
  return '';
}

/**
 * For agent response card preview: extract only the human-readable text
 * from the result, stripping trailing ```json code blocks (structured output metadata).
 * If the result is entirely a fenced JSON block, try to extract a text field from it.
 * Full content is always available via "View details".
 */
export function getAgentPreview(raw: string): string {
  const result = getAgentResult(raw);
  // Strip trailing ```json ... ``` blocks (structured status output)
  const stripped = result.replace(/\n*```json\s*\n[\s\S]*?```\s*$/i, '').trim();
  if (stripped) return stripped;
  // Result is entirely a fenced JSON block — try to extract a readable field from it
  const fromFence = extractFromFencedJSON(result);
  return fromFence || result.trim();
}

export function extractSection(raw: string, heading: string): string {
  const re = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  const match = raw.match(re);
  return match ? match[1].trim() : '';
}

export function getSupervisorPreview(raw: string, metadata: Record<string, unknown>): { intent: string; description: string } {
  const intent = (metadata.intent as string) || extractSection(raw, 'Intent');
  const description = extractSection(raw, 'Task Description') || extractSection(raw, 'Fix Instructions') || '';
  return { intent, description };
}
