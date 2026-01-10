import { ValidationStrategy, ValidationContext } from './validationStrategy';
import { Task, ValidationReport } from '../../types/types';
import { ProviderResult } from '../../executors/haltDetection';
import { interrogateAgent } from '../../executors/interrogator'; // Domain service
import { LLMProviderPort } from '../../ports/llmProvider';
import { PromptBuilder } from '../../agents/promptBuilder';
import { LoggerPort } from '../../ports/logger';
import { analyticsService } from '../../../application/services/analytics';

export class InterrogationValidator implements ValidationStrategy {
  name = 'InterrogationValidator';

  constructor(
    private cliAdapter: LLMProviderPort,
    private promptBuilder: PromptBuilder,
    private logger: LoggerPort,
    private sandboxRoot: string
  ) {}

  async validate(
    task: Task, 
    providerResult: ProviderResult, 
    context: ValidationContext,
    previousReport?: ValidationReport
  ): Promise<ValidationReport> {
    const { iteration, sandboxCwd, projectId, state } = context;

    // Skip if already valid
    if (!previousReport || previousReport.valid) {
      return previousReport || { valid: true, confidence: 'HIGH', rules_passed: [], rules_failed: [] };
    }

    // Determine if interrogation is needed
    // Policy: Not behavioral, AND (Confidence UNCERTAIN OR LOW+UncertainCriteria)
    const needsInterrogation = task.task_type !== 'behavioral' &&
        (previousReport.confidence === 'UNCERTAIN' || 
         (previousReport.confidence === 'LOW' && previousReport.uncertain_criteria && previousReport.uncertain_criteria.length > 0));

    if (!needsInterrogation) {
        return previousReport;
    }

    // Check if already performed for this attempt
    const retryKey = `retry_count_${task.task_id}`;
    const retryCount = (state.supervisor as any)[retryKey] || 0;
    const interrogationKey = `interrogation_performed_${task.task_id}_attempt_${retryCount}`;
    const interrogationAlreadyPerformed = (state.supervisor as any)[interrogationKey] || false;

    if (interrogationAlreadyPerformed) {
        this.logger.logVerbose('ControlLoop', 'Interrogation already performed for this attempt, skipping', { iteration });
        return previousReport;
    }

    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Entering interrogation phase`);
    
    // Mark performed (mutation managed by caller usually, but we need to ensure it persists)
    // In new architecture, we might return this flag or handle state update in Orchestrator.
    // For now, we'll return the modified report and let Orchestrator handle state.
    // BUT interrogation is expensive/stateful, so we should probably mark it here via context if mutable or return instruction.
    // Let's assume Orchestrator handles the persistence of this flag if we signal it. 
    // Actually, to match original logic EXACTLY, we must persist state BEFORE interrogation.
    // This implies we need access to persistence or callback. 
    // Given the constraints, let's assume the Orchestrator handles the pre-persistence based on our signal, 
    // OR we just perform it and assume the risk of duplicates on crash is acceptable (it's idempotent-ish).
    // Original code: Persist state immediately.
    // We will handle this in ValidationOrchestrator.

    const minimalState = this.promptBuilder.buildMinimalSnapshot(state, task, sandboxCwd);
    const interrogationStartTime = Date.now();
    
    // @todo: interrogateAgent expects CLIAdapter concrete, needs refactoring to accept LLMProviderPort
    // Casting for now to proceed, will fix interrogateAgent next
    const interrogationSession = await interrogateAgent(
        task,
        previousReport.failed_criteria || [],
        previousReport.uncertain_criteria || [],
        minimalState,
        sandboxCwd,
        this.cliAdapter as any,
        1, // max 1 question per criterion
        this.sandboxRoot,
        projectId
    );

    const interrogationDuration = Date.now() - interrogationStartTime;
    analyticsService.recordInterrogation(task.task_id, interrogationSession.interrogation_results.length, interrogationDuration);

    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Interrogation completed in ${interrogationDuration}ms`);
    
    if (interrogationSession.all_criteria_satisfied) {
        this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: ✅ All criteria confirmed COMPLETE via interrogation`);
        return {
            ...previousReport,
            valid: true,
            rules_passed: [...(previousReport.rules_passed || []), 'interrogation_confirmed'],
            rules_failed: [],
            confidence: 'HIGH'
        };
    } else {
        this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Interrogation did not resolve all criteria`);
        return {
            ...previousReport,
            failed_criteria: interrogationSession.remaining_failed_criteria,
            reason: `After interrogation, ${interrogationSession.remaining_failed_criteria.length} criteria still failed: ${interrogationSession.remaining_failed_criteria.join(', ')}`,
        };
    }
  }
}