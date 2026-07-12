import * as path from 'path';
import { SupervisorState, Task } from '../../../domain/types/types';
import { GitContext, resolveGitContext } from './gitContext';

export function getTaskRetryCount(state: SupervisorState, taskId: string): number {
  return ((state.supervisor as Record<string, unknown>)[`retry_count_${taskId}`] as number) || 0;
}

export function buildGitContextCacheKey(
  retryCount: number,
  executionSeq: number,
  sandboxCwd: string
): string {
  return `${retryCount}:${executionSeq}:${path.resolve(sandboxCwd)}`;
}

/** Call after each agent execution that may change the working tree. */
export function bumpGitContextExecutionSeq(state: SupervisorState, taskId: string): void {
  const active = state.active_tasks?.[taskId];
  if (!active) {
    return;
  }
  active.git_execution_seq = (active.git_execution_seq ?? 0) + 1;
  active.git_context = undefined;
  active.git_context_key = undefined;
}

export async function resolveGitContextForTask(
  state: SupervisorState,
  task: Task,
  sandboxCwd: string
): Promise<GitContext> {
  const resolvedCwd = path.resolve(sandboxCwd);
  const retryCount = getTaskRetryCount(state, task.task_id);
  const active = state.active_tasks?.[task.task_id];
  const executionSeq = active?.git_execution_seq ?? 0;
  const cacheKey = buildGitContextCacheKey(retryCount, executionSeq, resolvedCwd);

  if (active?.git_context && active.git_context_key === cacheKey) {
    return active.git_context;
  }

  const gitContext = await resolveGitContext(resolvedCwd);

  if (active) {
    active.git_context = gitContext;
    active.git_context_key = cacheKey;
    active.git_execution_seq = executionSeq;
  }

  return gitContext;
}
