import { SupervisorState } from '../../types/types';
import { PersistencePort } from '../../ports/persistence';
import { AuditLogPort, LegacyAuditLogEntry } from '../../ports/auditLog';
import { LoggerPort } from '../../ports/logger';

export class HaltHandler {
  constructor(
    private persistence: PersistencePort,
    private auditLogger: AuditLogPort & { append(entry: LegacyAuditLogEntry): Promise<void> },
    private logger: LoggerPort
  ) {}

  async halt(
    state: SupervisorState,
    reason: string,
    iteration: number,
    details?: string
  ): Promise<never> {
    state.supervisor.status = 'HALTED';
    state.supervisor.halt_reason = reason as any;
    if (details) {
      state.supervisor.halt_details = details;
    }
    
    this.logger.logStateTransition(state.supervisor.status, 'HALTED', { iteration, reason });
    
    // Persist before halting
    await this.persistence.writeState(state);
    
    // Log halt
    await this.auditLogger.append({
      event: 'HALT',
      reason,
      details,
      timestamp: new Date().toISOString(),
    });

    // Exit process - no automatic resume
    // eslint-disable-next-line no-process-exit
    if (typeof process !== 'undefined' && process.exit) {
      process.exit(1);
    }
    
    throw new Error('Halt function should never return');
  }
}
