import { ValidationStrategy, ValidationContext } from './validationStrategy';
import { Task, ValidationReport, CommandExecutionResult } from '../../types/types';
import { ProviderResult } from '../../executors/haltDetection';
import { generateValidationCommands } from '../../executors/commandGenerator'; // Domain service
import { LLMProviderPort } from '../../ports/llmProvider';
import { CommandExecutorPort } from '../../ports/commandExecutor';
import { LoggerPort, PromptLoggerPort } from '../../ports/logger';
import { analyticsService } from '../../../application/services/analytics'; // Requires specific path
import { SessionResolver } from '../../../application/services/controlLoop/modules/sessionResolver'; // Module import allowed for now

export class HelperAgentValidator implements ValidationStrategy {
  name = 'HelperAgentValidator';

  constructor(
    private cliAdapter: LLMProviderPort,
    private commandExecutor: CommandExecutorPort,
    private logger: LoggerPort,
    private promptLogger: PromptLoggerPort,
    private sessionResolver: SessionResolver,
    private sandboxRoot: string
  ) {}

  async validate(
    task: Task, 
    providerResult: ProviderResult, 
    context: ValidationContext,
    previousReport?: ValidationReport
  ): Promise<ValidationReport> {
    const { iteration, sandboxCwd, projectId, state } = context;
    
    // If valid or deterministic check passed (implicit in valid=true), skip
    if (!previousReport || previousReport.valid) {
      return previousReport || { valid: true, confidence: 'HIGH', rules_passed: [], rules_failed: [] };
    }

    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Attempting Helper Agent command generation...`);
    const helperAgentMode = process.env.HELPER_AGENT_MODE || 'auto';
    
    const helperFeatureId = `helper:validation:${projectId}`;
    const existingSession = state.active_sessions?.[helperFeatureId]?.session_id;

    if (existingSession) {
         this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Resuming helper session: ${existingSession}`);
    }

    this.logger.logVerbose('ControlLoop', 'Starting Helper Agent command generation', {
        iteration,
        task_id: task.task_id,
        helper_agent_mode: helperAgentMode,
        failed_criteria_count: previousReport.failed_criteria?.length || 0,
        helper_session_id: existingSession,
    });

    try {
        const helperStartTime = Date.now();
        const commandGeneration = await generateValidationCommands(
          providerResult.rawOutput || providerResult.stdout || '',
          previousReport.failed_criteria || [],
          sandboxCwd,
          this.cliAdapter as any, // @todo: generateValidationCommands expects CLIAdapter concrete, need to refactor it to accept Interface
          helperAgentMode,
          this.sandboxRoot,
          projectId,
          task.task_id,
          existingSession,
          helperFeatureId
        );
        
        // Update Helper Session in State
        if (commandGeneration.sessionId) {
            this.sessionResolver.updateSessionState(
                state,
                helperFeatureId,
                commandGeneration.sessionId,
                task,
                commandGeneration.usage?.tokens || 0,
                existingSession,
                iteration
            );
        }

        const cacheStats = commandGeneration.usage ? { 
            hit: (commandGeneration.usage as any).cache_read_input_tokens || 0,
            total: (commandGeneration.usage as any).input_tokens || commandGeneration.usage.tokens || 0
        } : undefined;
        analyticsService.recordHelperAgent(task.task_id, Date.now() - helperStartTime, cacheStats);

        this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Helper Agent result: isValid=${commandGeneration.isValid}, commands=${commandGeneration.verificationCommands.length}`);

        if (commandGeneration.isValid) {
            this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: ✅ Helper Agent confirmed validation via command generation`);
            return {
                ...previousReport,
                valid: true,
                reason: `Helper Agent confirmed validation via command generation: ${commandGeneration.reasoning || 'no reasoning provided'}`
            };
        } else if (commandGeneration.verificationCommands.length > 0) {
            this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Executing ${commandGeneration.verificationCommands.length} verification commands...`);
            
            const commandResults = await this.commandExecutor.executeVerificationCommands(
                commandGeneration.verificationCommands,
                sandboxCwd
            );

            this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Command execution result: ${commandResults.passed ? 'PASSED' : 'FAILED'}`);
            
             await this.promptLogger.appendPromptLog(
                 this.sandboxRoot,
                 projectId,
                 {
                   task_id: task.task_id,
                   iteration,
                   type: 'RESPONSE', 
                   content: `Command execution results:\n${commandResults.results.map((r: any) => `${r.command}: ${r.passed ? '\`PASSED\`' : '\`FAILED\`'} (exitCode=${r.exitCode})`).join('\n')}`,
                   metadata: {
                     provider: this.cliAdapter.getProviderInUse(),
                     working_directory: sandboxCwd,
                     prompt_type: 'command_execution',
                     command_execution_passed: commandResults.passed,
                     command_execution_results: commandResults.results.map((r: any) => ({
                       command: r.command,
                       exitCode: r.exitCode,
                       passed: r.passed,
                     })),
                   },
                 }
            );

            if (commandResults.passed) {
                this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: ✅ Verification commands passed`);
                return {
                    ...previousReport,
                    valid: true,
                    reason: 'Verification commands passed'
                };
            }
        }
    } catch (error) {
        this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Helper Agent command generation failed: ${error instanceof Error ? error.message : String(error)}`);
        // Fallthrough to return original report (failed)
    }

    return previousReport;
  }
}
