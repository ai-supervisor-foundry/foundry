// Port: Persistence
// Interface for state persistence

import { SupervisorState } from '../types/types';

export interface PersistencePort {
  /**
   * Read the current supervisor state
   */
  readState(): Promise<SupervisorState>;

  /**
   * Persist the supervisor state (full overwrite)
   */
  writeState(state: SupervisorState): Promise<void>;
}
