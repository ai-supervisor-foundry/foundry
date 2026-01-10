import { PersistenceLayer } from '../../persistence';
import { SupervisorState } from '../../../../domain/types/types';
import { logVerbose, logPerformance } from '../../../../infrastructure/adapters/logging/logger';

export class StateManager {
  constructor(private persistence: PersistenceLayer) {}

  async loadState(iteration: number): Promise<SupervisorState> {
    const stateLoadStartTime = Date.now();
    logVerbose('ControlLoop', 'Loading state from persistence layer');
    const state = await this.persistence.readState();
    const stateLoadDuration = Date.now() - stateLoadStartTime;
    logPerformance('StateLoad', stateLoadDuration, { iteration });
    return state;
  }

  deepCopyState(state: SupervisorState, iteration: number): SupervisorState {
    const stateCopyStartTime = Date.now();
    const stateCopy: SupervisorState = JSON.parse(JSON.stringify(state));
    const stateCopyDuration = Date.now() - stateCopyStartTime;
    logPerformance('StateCopy', stateCopyDuration, { 
      iteration, 
      stateSize: JSON.stringify(stateCopy).length 
    });
    return stateCopy;
  }

  validateRequiredFields(state: SupervisorState, iteration: number): void {
    const stateValidationStartTime = Date.now();
    logVerbose('ControlLoop', 'Validating required state fields');
    
    try {
      if (!state.supervisor) {
        throw new Error(`Missing required field: supervisor`);
      }
      if (!state.supervisor.status) {
        throw new Error(`Missing required field: supervisor.status`);
      }
      if (!state.goal) {
        throw new Error(`Missing required field: goal`);
      }
      if (!state.queue) {
        throw new Error(`Missing required field: queue`);
      }
      
      const validationDuration = Date.now() - stateValidationStartTime;
      logPerformance('StateValidation', validationDuration, { iteration });
      logVerbose('ControlLoop', 'State validation passed', { iteration });
    } catch (error) {
      const validationDuration = Date.now() - stateValidationStartTime;
      logPerformance('StateValidation', validationDuration, { iteration, failed: true });
      logVerbose('ControlLoop', 'State validation failed', {
        iteration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async persistState(state: SupervisorState, iteration: number, taskId?: string): Promise<void> {
    const persistStartTime = Date.now();
    await this.persistence.writeState(state);
    const persistDuration = Date.now() - persistStartTime;
    
    logPerformance('StatePersist', persistDuration, {
      iteration,
      task_id: taskId,
      state_size: JSON.stringify(state).length,
    });
    logVerbose('ControlLoop', 'State persisted successfully', {
      iteration,
      task_id: taskId,
      state_size_bytes: JSON.stringify(state).length,
    });
  }
}
