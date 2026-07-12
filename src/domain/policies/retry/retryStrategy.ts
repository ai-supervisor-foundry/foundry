import { Task, SupervisorState, ValidationReport } from '../../types/types';
import { LLMProviderPort } from '../../ports/llmProvider';

export interface RetryContext {
  cliAdapter: LLMProviderPort;
  sessionId?: string;
  projectId: string;
  iteration: number;
  /** Same cwd as task execution (e.g. in-sandbox worktree in parallel mode). */
  sandboxCwd?: string;
}

export interface RetryDecision {
  action: 'retry' | 'block' | 'complete';
  updatedState: SupervisorState;
  // If we executed a fix attempt, the result might be relevant (omitted for simplicity of interface)
}

export interface RetryStrategy {
  name: string;
  handle(
    task: Task,
    validationReport: ValidationReport,
    state: SupervisorState,
    context: RetryContext,
    haltReason?: string | null
  ): Promise<RetryDecision | null>; // null implies strategy doesn't apply or passes to next
}
