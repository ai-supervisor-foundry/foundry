import { TaskMetrics } from '../../domain/types/types';
import { logVerbose } from '../../infrastructure/adapters/logging/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export class AnalyticsService {
  private currentMetrics: Map<string, TaskMetrics> = new Map();
  private helperDurations: Map<string, number[]> = new Map(); // Store durations for P95 calc

  /**
   * Start tracking metrics for a new task
   */
  initializeTask(taskId: string): void {
    if (!this.currentMetrics.has(taskId)) {
      this.currentMetrics.set(taskId, {
        task_id: taskId,
        start_time: new Date().toISOString(),
        iterations: 0,
        status: 'COMPLETED', // Default, updated on completion
        time_in_execution_ms: 0,
        time_in_validation_ms: 0,
        time_in_interrogation_ms: 0,
        interrogation_rounds: 0,
        helper_agent_calls: 0,
        failed_validations: 0,
        deterministic_attempts: 0,
        deterministic_success: 0,
        helper_duration_ms_total: 0,
        helper_avg_ms: 0,
        helper_p95_ms: 0,
        cache_hit_rate: 0,
        total_prompt_chars: 0,
        total_response_chars: 0,
      });
      this.helperDurations.set(taskId, []);
    }
  }

  getMetrics(taskId: string): TaskMetrics {
    this.initializeTask(taskId);
    return this.currentMetrics.get(taskId)!;
  }

  recordIteration(taskId: string): void {
    const m = this.getMetrics(taskId);
    m.iterations++;
  }

  recordValidation(taskId: string, durationMs: number, success: boolean): void {
    const m = this.getMetrics(taskId);
    m.time_in_validation_ms += durationMs;
    if (!success) {
      m.failed_validations++;
    }
  }
  
  recordDeterministicValidation(taskId: string, success: boolean): void {
    const m = this.getMetrics(taskId);
    m.deterministic_attempts = (m.deterministic_attempts || 0) + 1;
    if (success) {
      m.deterministic_success = (m.deterministic_success || 0) + 1;
    }
  }

  recordInterrogation(taskId: string, rounds: number, durationMs: number): void {
    const m = this.getMetrics(taskId);
    m.interrogation_rounds += rounds;
    m.time_in_interrogation_ms += durationMs;
  }

  recordHelperAgent(taskId: string, durationMs: number, cacheStats?: { hit: number, total: number }): void {
    const m = this.getMetrics(taskId);
    m.helper_agent_calls++;
    m.helper_duration_ms_total = (m.helper_duration_ms_total || 0) + durationMs;
    
    // Store duration for stats
    const durations = this.helperDurations.get(taskId) || [];
    durations.push(durationMs);
    this.helperDurations.set(taskId, durations);
    
    // Update Avg
    m.helper_avg_ms = m.helper_duration_ms_total / m.helper_agent_calls;
    
    // Update P95
    const sorted = [...durations].sort((a, b) => a - b);
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    m.helper_p95_ms = sorted[p95Index];

    // Helper agent is part of validation phase usually
    m.time_in_validation_ms += durationMs;
    
    // Cache Stats
    if (cacheStats && cacheStats.total > 0) {
        // Simple moving average for cache hit rate
        const currentRate = cacheStats.hit / cacheStats.total;
        // If it's the first call, set it. Otherwise average it.
        // Actually, let's keep it simple: just record the latest or an average? 
        // Let's do a weighted average based on calls? No, simplistic is fine for now.
        // Let's just store the latest rate for visibility
        m.cache_hit_rate = parseFloat((currentRate * 100).toFixed(2));
    }
  }

  recordExecution(taskId: string, promptSize: number, responseSize: number, durationMs: number): void {
    const m = this.getMetrics(taskId);
    m.total_prompt_chars += promptSize;
    m.total_response_chars += responseSize;
    m.time_in_execution_ms += durationMs;
  }

  recordRetry(taskId: string, reason: string): void {
    const m = this.getMetrics(taskId);
    // We can log the reason or just increment a counter if we had one.
    // The plan didn't have retry count but iterations covers it mostly.
    logVerbose('Analytics', `Task retry recorded`, { task_id: taskId, reason });
  }

  /**
   * Finalize task metrics and persist to file
   */
  async finalizeTask(
    taskId: string, 
    status: 'COMPLETED' | 'FAILED' | 'BLOCKED',
    sandboxRoot: string,
    projectId: string
  ): Promise<void> {
    const m = this.currentMetrics.get(taskId);
    if (!m) return;

    m.status = status;
    m.end_time = new Date().toISOString();
    m.total_duration_ms = new Date(m.end_time).getTime() - new Date(m.start_time).getTime();

    // Persist to JSONL
    try {
      const metricsDir = path.join(sandboxRoot, projectId);
      await fs.mkdir(metricsDir, { recursive: true });
      const metricsPath = path.join(metricsDir, 'metrics.jsonl');
      
      await fs.appendFile(metricsPath, JSON.stringify(m) + '\n', 'utf8');
      logVerbose('Analytics', `Task metrics persisted to ${metricsPath}`, { task_id: taskId });
    } catch (error) {
      logVerbose('Analytics', `Failed to persist task metrics`, { 
        task_id: taskId, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }

    // Clean up memory
    this.currentMetrics.delete(taskId);
    this.helperDurations.delete(taskId);
  }

  logSummary(taskId: string): void {
    const m = this.currentMetrics.get(taskId);
    if (m) {
      logVerbose('Analytics', `Task Metrics for ${taskId}`, { metrics: m });
    }
  }
}

export const analyticsService = new AnalyticsService();