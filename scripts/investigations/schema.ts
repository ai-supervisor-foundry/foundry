// Shared types for investigation scripts
import { Provider } from '../../src/domain/agents/enums/provider';

export interface CircuitBreakerStatus {
  provider: Provider;
  triggered_at: string; // ISO timestamp
  expires_at: string; // ISO timestamp
  error_type: string;
}

export interface CircuitBreakerInfo {
  provider: Provider;
  status: 'active' | 'expired';
  triggered_at: Date;
  expires_at: Date;
  time_remaining_ms: number;
  time_remaining_readable: string;
  error_type: string;
}

export interface TaskStateInfo {
  task_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed';
  iteration: number;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  blocked_reason?: string;
  blocked_since?: string;
  agent_mode: string;
}

export interface SupervisorState {
  queue: string[];
  blocked_tasks: string[];
  failed_tasks: string[];
  current_task: string | null;
  supervisor: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ExecutionLogEntry {
  task_id: string;
  iteration: number;
  type: 'PROMPT' | 'RESPONSE' | 'HELPER_AGENT_RESPONSE' | 'INTERROGATION_PROMPT' | 'INTERROGATION_RESPONSE' | 'FIX_PROMPT';
  timestamp: string;
  metadata: {
    provider?: string;
    agent_mode?: string;
    exit_code?: number;
    stderr_length?: number;
    stdout_length?: number;
    [key: string]: unknown;
  };
  content: string;
}

export interface ProviderStats {
  provider: Provider;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate: number;
  last_execution?: string;
}

export interface ErrorPattern {
  pattern: string;
  regex: RegExp;
  count: number;
  last_seen: string;
  task_ids: string[];
}

export function calculateTimeRemaining(expiresAt: Date): { ms: number; readable: string } {
  const now = new Date();
  const ms = Math.max(0, expiresAt.getTime() - now.getTime());
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  
  let readable = '';
  if (hours > 0) readable += `${hours}h `;
  if (minutes > 0 || hours > 0) readable += `${minutes}m `;
  readable += `${seconds}s`;
  
  return { ms, readable };
}

export function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function getStatusEmoji(status: string | boolean): string {
  if (typeof status === 'boolean') {
    return status ? '🟢' : '🔴';
  }
  switch (status.toLowerCase()) {
    case 'active': return '🔴';
    case 'expired': return '⚪';
    case 'available': return '🟢';
    case 'circuit-broken': return '🔴';
    case 'unknown': return '⚠️';
    case 'blocked': return '🚫';
    case 'failed': return '❌';
    case 'pending': return '⏳';
    case 'in_progress': return '⚙️';
    case 'completed': return '✅';
    default: return '❓';
  }
}
