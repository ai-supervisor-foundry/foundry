import { SupervisorState, SupervisorStatus, Goal, Task, CompletedTask, BlockedTask, ActiveTask, FileLock, WorkerPoolConfig, SessionInfo } from '@/domain/types/types';

export class StateBuilder {
  private state: SupervisorState;

  constructor() {
    this.state = {
      supervisor: {
        status: 'RUNNING',
        iteration: 0,
      },
      goals: {
        'default-project': {
          description: 'Default Goal',
          completed: false,
          project_id: 'default-project',
        },
      },
      queue: {
        exhausted: false,
      },
      completed_tasks: [],
      blocked_tasks: [],
      last_updated: new Date().toISOString(),
      execution_mode: 'AUTO',
    };
  }

  static empty(): StateBuilder {
    return new StateBuilder();
  }

  static running(): StateBuilder {
    return new StateBuilder().withStatus('RUNNING');
  }

  static halted(reason: string): StateBuilder {
    return new StateBuilder().withStatus('HALTED').withHaltReason(reason);
  }

  withStatus(status: SupervisorStatus): this {
    this.state.supervisor.status = status;
    return this;
  }

  withIteration(iteration: number): this {
    this.state.supervisor.iteration = iteration;
    return this;
  }

  withGoal(description: string, project_id: string = 'test-project'): this {
    this.state.goals[project_id] = {
      description,
      completed: false,
      project_id,
    };
    return this;
  }

  withGoalCompleted(completed: boolean = true, project_id?: string): this {
    if (project_id) {
      if (this.state.goals[project_id]) {
        this.state.goals[project_id].completed = completed;
      }
    } else {
      // Mark all goals
      for (const goal of Object.values(this.state.goals)) {
        goal.completed = completed;
      }
    }
    return this;
  }

  withCompletedTasks(tasks: CompletedTask[]): this {
    this.state.completed_tasks = [...tasks];
    return this;
  }

  withBlockedTasks(tasks: BlockedTask[]): this {
    this.state.blocked_tasks = [...tasks];
    return this;
  }

  withActiveTask(task: Task, workerId: string = 'main'): this {
    if (!this.state.active_tasks) this.state.active_tasks = {};
    this.state.active_tasks[task.task_id] = {
      task,
      worker_id: workerId,
      started_at: new Date().toISOString(),
    };
    return this;
  }

  withHaltReason(reason: string, details?: string): this {
    this.state.supervisor.halt_reason = reason;
    this.state.supervisor.halt_details = details;
    return this;
  }

  withFileLocks(locks: Record<string, FileLock>): this {
    this.state.file_locks = locks;
    return this;
  }

  withWorkerPool(config: WorkerPoolConfig): this {
    this.state.worker_pool = config;
    return this;
  }

  withExecutionMode(mode: 'AUTO' | 'MANUAL'): this {
    this.state.execution_mode = mode;
    return this;
  }

  withActiveSessions(sessions: Record<string, SessionInfo>): this {
    this.state.active_sessions = { ...sessions };
    return this;
  }

  build(): SupervisorState {
    this.state.last_updated = new Date().toISOString();
    return JSON.parse(JSON.stringify(this.state)); // Return a deep copy
  }
}
