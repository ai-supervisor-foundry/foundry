import { ValidationStrategy, ValidationContext } from './validationStrategy';
import { Task, ValidationReport } from '../../types/types';
import { ProviderResult } from '../../executors/haltDetection';
import { attemptDeterministicValidation } from '../../../application/services/deterministicValidator'; // Acceptable
import { DETERMINISTIC_VALIDATION_RULES } from '../../../config/deterministicValidationRules'; // Config is fine
import { LoggerPort } from '../../ports/logger';
import { analyticsService } from '../../../application/services/analytics';

export class DeterministicValidator implements ValidationStrategy {
  name = 'DeterministicValidator';

  constructor(private logger: LoggerPort) {}

  async validate(
    task: Task, 
    providerResult: ProviderResult, 
    context: ValidationContext,
    previousReport?: ValidationReport
  ): Promise<ValidationReport> {
    const { iteration, sandboxCwd } = context;
    
    // If no previous report or it's valid, skip
    if (!previousReport || previousReport.valid) {
      return previousReport || { valid: true, confidence: 'HIGH', rules_passed: [], rules_failed: [] };
    }

    // Feature Flag Check
    const detEnabled = process.env.HELPER_DETERMINISTIC_ENABLED !== 'false';
    const detPercent = Math.max(0, Math.min(100, parseInt(process.env.HELPER_DETERMINISTIC_PERCENT || '100', 10)));
    const inBucket = (Math.random() * 100) < detPercent;

    if (!detEnabled || !inBucket) {
      this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Deterministic validation skipped by flag/percent`);
      return previousReport;
    }

    const deterministicResult = await attemptDeterministicValidation(
        previousReport.failed_criteria || [],
        providerResult.rawOutput || providerResult.stdout || '',
        sandboxCwd,
        DETERMINISTIC_VALIDATION_RULES
    );

    if (deterministicResult.canValidate) {
        if (deterministicResult.confidence === 'high' && deterministicResult.valid) {
            analyticsService.recordDeterministicValidation(task.task_id, true);
            this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: ✅ Deterministic validation passed (HIGH confidence), skipping helper agent`);
            
            return {
                ...previousReport,
                valid: true,
                reason: `Deterministic validation: ${deterministicResult.reason}`,
                confidence: 'HIGH'
            };
        } else {
            analyticsService.recordDeterministicValidation(task.task_id, false);
            this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Deterministic validation passed but confidence not HIGH or valid=false`);
        }
    } else {
        analyticsService.recordDeterministicValidation(task.task_id, false);
        this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Cannot validate deterministically`);
    }

    return previousReport;
  }
}
