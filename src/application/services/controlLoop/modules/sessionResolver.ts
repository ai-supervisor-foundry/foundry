import { SupervisorState, Task } from '../../../../domain/types/types';
import { sessionManager } from '../../../../domain/agents/sessionManager';
import { log as logShared } from '../../../../infrastructure/adapters/logging/logger';

// Limits from controlLoop.ts
const CONTEXT_LIMITS: Record<string, number> = {
  'gemini': 350_000,
  'gemini-stub': 350_000,
  'copilot': 350_000,
  'cursor': 250_000,
  'codex': 8_000,
  'claude': 250_000,
};
const ERROR_LIMIT = 5;

export class SessionResolver {
  
  async resolveSession(task: Task, state: SupervisorState, iteration: number): Promise<string | undefined> {
    // 1. Initial resolution via SessionManager
    let resolvedSessionId = await sessionManager.resolveSession(
      task.tool,
      task.meta?.feature_id,
      task.meta?.session_id,
      state
    );
    
    // Feature ID calculation
    const featureId = this.getFeatureId(task, state);
    
    // 2. Policy Enforcement
    if (resolvedSessionId && state.active_sessions?.[featureId]) {
      const session = state.active_sessions[featureId];
      const contextLimit = CONTEXT_LIMITS[task.tool] || 100_000;

      if (session.total_tokens && session.total_tokens > contextLimit) {
        logShared('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Session context limit exceeded (${session.total_tokens} > ${contextLimit}). Starting new session.`);
        resolvedSessionId = undefined;
      } else if (session.error_count >= ERROR_LIMIT) {
        logShared('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Session error limit exceeded (${session.error_count} >= ${ERROR_LIMIT}). Starting new session.`);
        resolvedSessionId = undefined;
      }
    }
    
    return resolvedSessionId;
  }

  getFeatureId(task: Task, state: SupervisorState): string {
    return task.meta?.feature_id 
      || (task.task_id ? `task:${task.task_id.split('_')[0]}` : undefined)
      || (state.goal.project_id ? `project:${state.goal.project_id}` : undefined)
      || 'default';
  }

  updateSessionState(
    state: SupervisorState, 
    featureId: string, 
    sessionId: string, 
    task: Task,
    usageTokens: number,
    resolvedSessionId: string | undefined, // To know if we reused
    iteration: number
  ): void {
      if (!state.active_sessions) state.active_sessions = {};
      
      const currentSession = state.active_sessions[featureId];
      const accumulatedTokens = (resolvedSessionId === sessionId && currentSession) 
        ? (currentSession.total_tokens || 0) + usageTokens 
        : usageTokens;

      state.active_sessions[featureId] = {
        session_id: sessionId,
        provider: task.tool,
        last_used: new Date().toISOString(),
        error_count: currentSession && resolvedSessionId === sessionId ? currentSession.error_count : 0,
        total_tokens: accumulatedTokens,
        feature_id: featureId,
        task_id: task.task_id
      };
      
      logShared('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Session ${sessionId} updated in state (Tokens: ${accumulatedTokens}, Errors: ${state.active_sessions[featureId].error_count})`);
  }
}
