import { ValidationStrategy, ValidationContext } from './validationStrategy';
import { Task, ValidationReport } from '../../types/types';
import { ProviderResult } from '../../executors/haltDetection';
import { validateTaskOutput } from '../../../application/services/validator'; // Still in app service, but acceptable as utility for now
import { LoggerPort } from '../../ports/logger';
import { analyticsService } from '../../../application/services/analytics'; // Global singleton, debatable but acceptable for now

export class StandardValidator implements ValidationStrategy {
  name = 'StandardValidator';

  constructor(private logger: LoggerPort) {}

  async validate(
    task: Task, 
    providerResult: ProviderResult, 
    context: ValidationContext
  ): Promise<ValidationReport> {
    const { iteration, sandboxCwd, projectId } = context;
    
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Validating output...`);
    this.logger.logVerbose('ControlLoop', 'Starting validation', {
      iteration,
      task_id: task.task_id,
      sandbox_cwd: sandboxCwd,
      has_expected_json_schema: !!task.expected_json_schema,
      has_required_artifacts: !!(task.required_artifacts && task.required_artifacts.length > 0),
      tests_required: task.tests_required || false,
      acceptance_criteria_count: task.acceptance_criteria?.length || 0,
    });

    const validationStartTime = Date.now();
    // @todo: In strict hexagonal, validateTaskOutput should be a Domain Service or Port
    // For now, we import the implementation to avoid massive refactor of validator.ts
    const validationReport = await validateTaskOutput(
      task,
      providerResult,
      sandboxCwd,
      projectId
    );
    const validationDuration = Date.now() - validationStartTime;

    analyticsService.recordValidation(
      task.task_id, 
      validationDuration, 
      validationReport.valid
    );

    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Validation completed in ${validationDuration}ms`);
    this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Validation result: ${validationReport.valid ? 'PASS' : 'FAIL'}`);
    this.logger.logPerformance('Validation', validationDuration, {
      iteration,
      task_id: task.task_id,
      valid: validationReport.valid,
      rules_passed_count: validationReport.rules_passed?.length || 0,
      rules_failed_count: validationReport.rules_failed?.length || 0,
    });

    if (!validationReport.valid) {
      this.logger.log('ControlLoop', `[Iteration ${iteration}] Task ${task.task_id}: Validation reason: ${validationReport.reason}`);
      this.logger.logVerbose('ControlLoop', 'Validation failed', {
        iteration,
        task_id: task.task_id,
        reason: validationReport.reason,
        rules_passed: validationReport.rules_passed || [],
        rules_failed: validationReport.rules_failed || [],
      });
    }

    return validationReport;
  }
}
