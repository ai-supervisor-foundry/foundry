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
    const allGoalsCompleted = Object.values(state.goals).every(g => g.completed);
    this.logger.logVerbose('ControlLoop', 'No task available, checking queue and goal status', {
      iteration,
      queue_exhausted: state.queue.exhausted,
      all_goals_completed: allGoalsCompleted,
      goal_count: Object.keys(state.goals).length,
    });
    
    // mark queue.exhausted = true
    const previousExhausted = state.queue.exhausted;
    state.queue.exhausted = true;
    if (previousExhausted !== state.queue.exhausted) {
      this.logger.logStateTransition('QUEUE_ACTIVE', 'QUEUE_EXHAUSTED', { iteration });
    }
    
    // If all goals are already completed, return true
    if (allGoalsCompleted && Object.keys(state.goals).length > 0) {
        return { completed: true, shouldHalt: false };
    }

    // if goal not completed → Ask agent if goal is met
    if (process.env.IS_ENABLED_GOAL_COMPLETION_CHECK === 'false') {
      this.logger.log('ControlLoop', `[Iteration ${iteration}] Goal completion check is disabled, skipping...`);
      this.logger.logVerbose('ControlLoop', 'Goal completion check is disabled, skipping goal completion evaluation', { iteration });
      
      // Return false but no halt - control loop should sleep and continue
      return { completed: false, shouldHalt: false }; 
    }
    
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Queue exhausted, checking if goals are met...`);
    const goalDescriptions = Object.entries(state.goals).map(([pid, g]) => `${pid}: ${g.description}`);
    this.logger.logVerbose('ControlLoop', 'Asking agent if goals are completed', {
        iteration,
        goal_descriptions: goalDescriptions,
        completed_tasks_count: state.completed_tasks?.length || 0,
        blocked_tasks_count: state.blocked_tasks?.length || 0,
    });

    // Build goal completion check prompt
    const goalCheckPrompt = buildGoalCompletionPrompt(state, this.sandboxRoot);
    const firstProjectId = Object.keys(state.goals)[0] || 'default';
    const goalCheckCwd = this.sandboxRoot;
    
    // Log goal check prompt
    await this.promptLogger.appendPromptLog(
        this.sandboxRoot,
        firstProjectId,
        {
        task_id: 'goal-completion-check',
        iteration,
        type: 'GOAL_COMPLETION_CHECK',
        content: goalCheckPrompt,
        metadata: {
            agent_mode: 'auto',
            provider: this.cliAdapter.getProviderInUse(),
            working_directory: goalCheckCwd,
            prompt_length: goalCheckPrompt.length,
        },
        }
    );
    
    // Ask agent if goal is met
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Asking agent if goal is completed...`);
    const goalSessionId = state.active_sessions?.['default']?.session_id || state.active_sessions?.[firstProjectId]?.session_id;
    const goalCheckResult = await this.cliAdapter.execute(goalCheckPrompt, goalCheckCwd, 'auto', goalSessionId);
    const goalCheckResponse = goalCheckResult.stdout || goalCheckResult.rawOutput || '';
    
    // Log goal check response
    await this.promptLogger.appendPromptLog(
        this.sandboxRoot,
        firstProjectId,
        {
        task_id: 'goal-completion-check',
        iteration,
        type: 'GOAL_COMPLETION_RESPONSE',
        content: goalCheckResponse,
        metadata: {
            agent_mode: 'auto',
            provider: this.cliAdapter.getProviderInUse(),
            working_directory: goalCheckCwd,
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