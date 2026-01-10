import * as path from 'path';
import { PromptBuilder, buildPrompt, detectTaskType } from '../../../../domain/agents/promptBuilder';
import { analyticsService } from '../../analytics';
import { SupervisorState, Task } from '../../../../domain/types/types';
import { ProviderResult } from '../../../../domain/executors/haltDetection';
import { SessionResolver } from './sessionResolver';
import { LLMProviderPort } from '../../../../domain/ports/llmProvider';
import { LoggerPort, PromptLoggerPort } from '../../../../domain/ports/logger';

export interface ExecutionResult {
  providerResult: ProviderResult;
  prompt: string;
  response: string;
  sessionId?: string;
  resolvedSessionId?: string; // The one we tried to use
  featureId: string;
  sandboxCwd: string;
}

export class TaskExecutor {
  constructor(
    private promptBuilder: PromptBuilder,
    private cliAdapter: LLMProviderPort,
    private logger: LoggerPort,
    private promptLogger: PromptLoggerPort,
    private sandboxRoot: string
  ) {}

  async executeTask(
    task: Task, 
    state: SupervisorState, 
    iteration: number, 
    sessionResolver: SessionResolver
  ): Promise<ExecutionResult> {
    // 1. Determine Working Directory
    const cwdDeterminationStartTime = Date.now();
    const sandboxCwd = task.working_directory
      ? path.join(this.sandboxRoot, task.working_directory)
      : `${this.sandboxRoot}/${state.goal.project_id || 'default'}`;
    const cwdDeterminationDuration = Date.now() - cwdDeterminationStartTime;
    this.logger.logPerformance('CwdDetermination', cwdDeterminationDuration, { iteration, task_id: task.task_id });
    
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Working directory: ${sandboxCwd}`);
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Intent: ${task.intent}`);
    this.logger.logVerbose('ControlLoop', 'Working directory determined', {
      iteration,
      task_id: task.task_id,
      working_directory: sandboxCwd,
      has_task_override: !!task.working_directory,
      project_id: state.goal.project_id || 'default',
    });

    // 2. Build Prompt
    const promptBuildStartTime = Date.now();
    const minimalState = this.promptBuilder.buildMinimalSnapshot(state, task, sandboxCwd);
    const prompt = buildPrompt(task, minimalState);
    const promptBuildDuration = Date.now() - promptBuildStartTime;
    this.logger.logPerformance('PromptBuild', promptBuildDuration, {
      iteration,
      task_id: task.task_id,
      prompt_length: prompt.length,
    });
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Prompt built (${prompt.length} chars)`);

    // 3. Resolve Session
    const resolvedSessionId = await sessionResolver.resolveSession(task, state, iteration);
    const featureId = sessionResolver.getFeatureId(task, state);
    
    // 4. Determine Agent Mode
    const taskType = detectTaskType(task);
    const defaultAgentMode = taskType === 'behavioral' ? 'fast' 
                           : taskType === 'verification' ? 'reasoning' 
                           : 'auto';
    const agentMode = task.agent_mode || defaultAgentMode;
    const projectId = state.goal.project_id || 'default';

    // 5. Log Prompt
    // Using Port
    await this.promptLogger.appendPromptLog(
      this.sandboxRoot,
      projectId,
      {
        task_id: task.task_id,
        iteration,
        type: 'PROMPT',
        content: prompt,
        metadata: {
          agent_mode: agentMode,
          provider: this.cliAdapter.getProviderInUse(),
          working_directory: sandboxCwd,
          prompt_length: prompt.length,
          intent: task.intent,
          session_id: resolvedSessionId,
        },
      }
    );

    // 6. Execute Provider
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Executing CLI / Agent with agent mode: ${agentMode}${resolvedSessionId ? ` (Session: ${resolvedSessionId})` : ''}...`);
    this.logger.logVerbose('ControlLoop', 'Dispatching to CLI / Agent', {
      iteration,
      task_id: task.task_id,
      agent_mode: agentMode,
      session_id: resolvedSessionId,
    });
    
    const providerStartTime = Date.now();
    const providerResult = await this.cliAdapter.execute(prompt, sandboxCwd, agentMode, resolvedSessionId, featureId);
    const providerDuration = Date.now() - providerStartTime;
    analyticsService.recordExecution(task.task_id, prompt.length, (providerResult.stdout || providerResult.rawOutput || '').length, providerDuration);

    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: CLI / Agent completed in ${providerDuration}ms, exit code: ${providerResult.exitCode}`);
    this.logger.logPerformance('CLIAdapterExecution', providerDuration, {
      iteration,
      task_id: task.task_id,
      exit_code: providerResult.exitCode,
    });

    // 7. Log Response
    const responseContent = providerResult.stdout || providerResult.rawOutput || '';
    await this.promptLogger.appendPromptLog(
      this.sandboxRoot,
      projectId,
      {
        task_id: task.task_id,
        iteration,
        type: 'RESPONSE',
        content: responseContent,
        metadata: {
          agent_mode: agentMode,
          provider: this.cliAdapter.getProviderInUse(),
          working_directory: sandboxCwd,
          response_length: responseContent.length,
          stdout_length: providerResult.stdout?.length || 0,
          stderr_length: providerResult.stderr?.length || 0,
          exit_code: providerResult.exitCode,
          duration_ms: providerDuration,
        },
      }
    );

    return {
      providerResult,
      prompt,
      response: responseContent,
      sessionId: providerResult.sessionId, // The actual session ID used/returned
      resolvedSessionId, // The one we requested
      featureId,
      sandboxCwd
    };
  }
}