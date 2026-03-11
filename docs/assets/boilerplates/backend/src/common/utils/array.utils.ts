/**
 * Deduplicate numbers, preserving first occurrence order.
 * Reusable for assigneeIds and similar id arrays.
 */
export function dedupeNumbers(arr: number[]): number[] {
  return [...new Set(arr)];
}
