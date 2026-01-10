import { SupervisorState, Task, ValidationReport } from '../../../../domain/types/types';
import { ProviderResult } from '../../../../domain/executors/haltDetection';

export interface ControlLoopContext {
    iteration: number;
    startTime: number;
    sandboxRoot: string;
    projectId: string;
    sandboxCwd: string;
}

export interface TaskExecutionContext {
    task: Task;
    prompt: string;
    response: string;
    providerResult: ProviderResult;
    sessionId?: string;
    featureId: string;
}
