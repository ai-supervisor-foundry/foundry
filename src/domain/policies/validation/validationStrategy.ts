import { Task, ValidationReport, SupervisorState } from '../../types/types';
import { ProviderResult } from '../../executors/haltDetection';

export interface ValidationContext {
  state: SupervisorState; // Use strict type
  sandboxCwd: string;
  projectId: string;
  iteration: number;
}

export interface ValidationStrategy {
  name: string;
  validate(
    task: Task, 
    providerResult: ProviderResult, 
    context: ValidationContext,
    previousReport?: ValidationReport
  ): Promise<ValidationReport>;
}
