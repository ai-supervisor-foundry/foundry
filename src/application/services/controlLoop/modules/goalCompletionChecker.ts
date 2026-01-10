import * as path from 'path';
import { SupervisorState } from '../../../../domain/types/types';
import { buildGoalCompletionPrompt, parseGoalCompletionResponse } from '../../../../domain/agents/promptBuilder';
import { LLMProviderPort } from '../../../../domain/ports/llmProvider';
import { LoggerPort, PromptLoggerPort } from '../../../../domain/ports/logger';

export interface GoalCheckResult {
  completed: boolean;
  shouldHalt: boolean;
  reason?: string;
  agentResponse?: string;
}

export class GoalCompletionChecker {
  constructor(
    private cliAdapter: LLMProviderPort,
    private logger: LoggerPort,
    private promptLogger: PromptLoggerPort,
    private sandboxRoot: string
  ) {}

  async checkGoalCompletion(state: SupervisorState, iteration: number): Promise<GoalCheckResult> {
    this.logger.log('ControlLoop', `[Iteration ${iteration}] No task available`);
    this.logger.logVerbose('ControlLoop', 'No task available, checking queue and goal status', {
      iteration,
      queue_exhausted: state.queue.exhausted,
      goal_completed: state.goal.completed,
    });
    
    // mark queue.exhausted = true
    const previousExhausted = state.queue.exhausted;
    state.queue.exhausted = true;
    if (previousExhausted !== state.queue.exhausted) {
      this.logger.logStateTransition('QUEUE_ACTIVE', 'QUEUE_EXHAUSTED', { iteration });
    }
    
    // If goal is already completed, return true
    if (state.goal.completed) {
        return { completed: true, shouldHalt: false };
    }

    // if goal not completed → Ask agent if goal is met
    if (process.env.IS_ENABLED_GOAL_COMPLETION_CHECK === 'false') {
      this.logger.log('ControlLoop', `[Iteration ${iteration}] Goal completion check is disabled, skipping...`);
      this.logger.logVerbose('ControlLoop', 'Goal completion check is disabled, skipping goal completion evaluation', { iteration });
      
      // Return false but no halt - control loop should sleep and continue
      return { completed: false, shouldHalt: false }; 
    }
    
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Queue exhausted, checking if goal is met...`);
    this.logger.logVerbose('ControlLoop', 'Asking agent if goal is completed', {
        iteration,
        goal_description: state.goal.description,
        completed_tasks_count: state.completed_tasks?.length || 0,
        blocked_tasks_count: state.blocked_tasks?.length || 0,
    });
    
    // Build goal completion check prompt
    const goalCheckPrompt = buildGoalCompletionPrompt(state, this.sandboxRoot);
    const projectId = state.goal.project_id || 'default';
    const sandboxCwd = path.join(this.sandboxRoot, projectId);
    
    // Log goal check prompt
    await this.promptLogger.appendPromptLog(
        this.sandboxRoot,
        projectId,
        {
        task_id: 'goal-completion-check',
        iteration,
        type: 'GOAL_COMPLETION_CHECK',
        content: goalCheckPrompt,
        metadata: {
            agent_mode: 'auto',
            provider: this.cliAdapter.getProviderInUse(),
            working_directory: sandboxCwd,
            prompt_length: goalCheckPrompt.length,
        },
        }
    );
    
    // Ask agent if goal is met
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Asking agent if goal is completed...`);
    const goalSessionId = state.active_sessions?.['default']?.session_id || state.active_sessions?.[projectId]?.session_id;
    const goalCheckResult = await this.cliAdapter.execute(goalCheckPrompt, sandboxCwd, 'auto', goalSessionId);
    const goalCheckResponse = goalCheckResult.stdout || goalCheckResult.rawOutput || '';
    
    // Log goal check response
    await this.promptLogger.appendPromptLog(
        this.sandboxRoot,
        projectId,
        {
        task_id: 'goal-completion-check',
        iteration,
        type: 'GOAL_COMPLETION_RESPONSE',
        content: goalCheckResponse,
        metadata: {
            agent_mode: 'auto',
            provider: this.cliAdapter.getProviderInUse(),
            working_directory: sandboxCwd,
            response_length: goalCheckResponse.length,
        },
        }
    );
    
    // Parse agent response to determine if goal is completed
    const goalCompleted = parseGoalCompletionResponse(goalCheckResponse);
    
    if (goalCompleted) {
        this.logger.log('ControlLoop', `[Iteration ${iteration}] Agent confirmed goal is completed`);
        return { completed: true, shouldHalt: false, agentResponse: goalCheckResponse };
    } else {
        this.logger.log('ControlLoop', `[Iteration ${iteration}] Agent confirmed goal is NOT completed - halting`);
        return { 
        completed: false, 
        shouldHalt: true, 
        reason: `Task queue exhausted and agent confirmed goal is incomplete: ${goalCheckResponse.substring(0, 200)}`,
        agentResponse: goalCheckResponse
        };
    }
  }
}