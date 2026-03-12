// Worker Pool Manager
// Manages a pool of child processes for parallel task execution.
// Pre-spawns workers, dispatches tasks, handles completion events, heartbeat monitoring.

import { fork, ChildProcess } from 'child_process';
import { WorkerCommand, WorkerEvent, WorkerConfig } from './protocol';
import { Task } from '../../domain/types/types';

function log(message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [WorkerPool] ${message}`, data ? JSON.stringify(data) : '');
}

interface WorkerHandle {
  process: ChildProcess;
  id: string;
  busy: boolean;
  lastHeartbeat: number;
  currentTaskId?: string;
  resolve?: (event: WorkerEvent) => void;
}

export class WorkerPool {
  private workers: Map<string, WorkerHandle> = new Map();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private shutdownRequested = false;

  constructor(
    private maxWorkers: number,
    private workerScriptPath: string,
    private heartbeatTimeoutMs: number = 60000
  ) {}

  /**
   * Initialize the pool — spawn all workers and wait for READY signals.
   */
  async init(): Promise<void> {
    log('Initializing worker pool', { maxWorkers: this.maxWorkers });

    const readyPromises: Promise<void>[] = [];

    for (let i = 0; i < this.maxWorkers; i++) {
      const id = `worker-${i}`;
      const readyPromise = this.spawnWorker(id);
      readyPromises.push(readyPromise);
    }

    await Promise.all(readyPromises);

    // Start health check
    this.healthCheckInterval = setInterval(() => this.checkHealth(), this.heartbeatTimeoutMs / 2);

    log('Worker pool initialized', { activeWorkers: this.workers.size });
  }

  private spawnWorker(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = fork(this.workerScriptPath, [], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });

      // Pipe child stdout/stderr to parent with worker prefix
      child.stdout?.on('data', (data: Buffer) => {
        process.stdout.write(`[${id}] ${data.toString()}`);
      });
      child.stderr?.on('data', (data: Buffer) => {
        process.stderr.write(`[${id}] ${data.toString()}`);
      });

      const handle: WorkerHandle = {
        process: child,
        id,
        busy: false,
        lastHeartbeat: Date.now(),
      };

      child.on('message', (msg: WorkerEvent) => {
        this.handleWorkerMessage(id, msg);
      });

      child.on('exit', (code, signal) => {
        log('Worker exited', { id, code, signal });
        this.workers.delete(id);

        // Respawn if not shutting down
        if (!this.shutdownRequested) {
          log('Respawning worker', { id });
          this.spawnWorker(id).catch(err => {
            log('Failed to respawn worker', { id, error: String(err) });
          });
        }
      });

      child.on('error', (err) => {
        log('Worker error', { id, error: err.message });
      });

      // Wait for initial READY signal
      const onReady = (msg: WorkerEvent) => {
        if (msg.type === 'READY') {
          child.removeListener('message', onReady);
          this.workers.set(id, handle);
          resolve();
        }
      };
      child.on('message', onReady);

      // Timeout for initial ready
      setTimeout(() => {
        if (!this.workers.has(id)) {
          child.kill();
          reject(new Error(`Worker ${id} failed to become ready within timeout`));
        }
      }, 30000);
    });
  }

  private handleWorkerMessage(workerId: string, msg: WorkerEvent): void {
    const handle = this.workers.get(workerId);
    if (!handle) return;

    switch (msg.type) {
      case 'HEARTBEAT':
        handle.lastHeartbeat = Date.now();
        break;

      case 'READY':
        handle.busy = false;
        handle.currentTaskId = undefined;
        break;

      case 'TASK_COMPLETED':
      case 'TASK_FAILED':
      case 'TASK_BLOCKED':
        handle.busy = false;
        handle.currentTaskId = undefined;
        handle.lastHeartbeat = Date.now();
        if (handle.resolve) {
          handle.resolve(msg);
          handle.resolve = undefined;
        }
        break;
    }
  }

  private checkHealth(): void {
    const now = Date.now();
    for (const [id, handle] of this.workers) {
      if (handle.busy && (now - handle.lastHeartbeat) > this.heartbeatTimeoutMs) {
        log('Worker heartbeat timeout — killing', {
          id,
          taskId: handle.currentTaskId,
          lastHeartbeatAgo: now - handle.lastHeartbeat,
        });

        // Resolve pending promise as failure
        if (handle.resolve) {
          handle.resolve({
            type: 'TASK_FAILED',
            taskId: handle.currentTaskId || 'unknown',
            reason: 'Worker heartbeat timeout',
          });
          handle.resolve = undefined;
        }

        handle.process.kill('SIGKILL');
        // Worker exit handler will respawn
      }
    }
  }

  /**
   * Dispatch a task to an available worker.
   * Returns a promise that resolves when the worker completes the task.
   */
  async dispatch(task: Task, worktreePath: string, config: WorkerConfig): Promise<WorkerEvent> {
    const handle = this.findIdleWorker();
    if (!handle) {
      throw new Error('No available workers');
    }

    handle.busy = true;
    handle.currentTaskId = task.task_id;
    handle.lastHeartbeat = Date.now();

    const command: WorkerCommand = {
      type: 'TASK_ASSIGNED',
      task,
      worktreePath,
      config,
    };

    return new Promise<WorkerEvent>((resolve) => {
      handle.resolve = resolve;
      handle.process.send(command);
      log('Task dispatched', { workerId: handle.id, taskId: task.task_id });
    });
  }

  private findIdleWorker(): WorkerHandle | undefined {
    for (const handle of this.workers.values()) {
      if (!handle.busy) return handle;
    }
    return undefined;
  }

  get availableWorkers(): number {
    let count = 0;
    for (const handle of this.workers.values()) {
      if (!handle.busy) count++;
    }
    return count;
  }

  get activeWorkers(): number {
    let count = 0;
    for (const handle of this.workers.values()) {
      if (handle.busy) count++;
    }
    return count;
  }

  get totalWorkers(): number {
    return this.workers.size;
  }

  /**
   * Graceful shutdown — send SHUTDOWN to all workers and wait.
   */
  async shutdown(): Promise<void> {
    this.shutdownRequested = true;
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    log('Shutting down worker pool', { workerCount: this.workers.size });

    const shutdownPromises: Promise<void>[] = [];
    for (const handle of this.workers.values()) {
      const p = new Promise<void>((resolve) => {
        handle.process.once('exit', () => resolve());
        const cmd: WorkerCommand = { type: 'SHUTDOWN' };
        handle.process.send(cmd);

        // Force kill after 10 seconds
        setTimeout(() => {
          if (handle.process.exitCode === null) {
            handle.process.kill('SIGKILL');
          }
          resolve();
        }, 10000);
      });
      shutdownPromises.push(p);
    }

    await Promise.all(shutdownPromises);
    this.workers.clear();
    log('Worker pool shut down');
  }

  /**
   * Emergency halt — kill all workers immediately.
   */
  async halt(): Promise<void> {
    this.shutdownRequested = true;
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    log('Halting worker pool', { workerCount: this.workers.size });

    for (const handle of this.workers.values()) {
      const cmd: WorkerCommand = { type: 'HALT' };
      try {
        handle.process.send(cmd);
      } catch {
        // Process may already be dead
      }
      handle.process.kill('SIGKILL');
    }
    this.workers.clear();
    log('Worker pool halted');
  }
}
