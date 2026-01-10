// Port: Audit Log
// Interface for append-only audit logging

import { SupervisorState, Task, ValidationReport } from '../types/types';

export interface LegacyAuditLogEntry {
  event: string;
  reason?: string;
  details?: string;
  timestamp: string;
  task_id?: string;
  validation_summary?: ValidationReport;
  [key: string]: unknown;
}

export interface AuditLogPort {
  /**
   * Append an entry to the audit log
   */
  appendAuditLog(
    stateBefore: SupervisorState,
    stateAfter: SupervisorState,
    task: Task,
    validationReport: ValidationReport,
    sandboxRoot: string,
    projectId: string,
    prompt?: string,
    response?: string
  ): Promise<void>;

  /**
   * Append legacy unstructured entry
   */
  append(entry: LegacyAuditLogEntry): Promise<void>;
}