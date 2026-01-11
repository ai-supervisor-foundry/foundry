import { SupervisorState, SupervisorStatus, Task, CompletedTask, BlockedTask } from '@/domain/types/types';

export class StateBuilder {
  private state: SupervisorState;

  constructor() {
    this.state = {
      supervisor: {
        status: 'RUNNING',
        iteration: 0,
      },
      goal: {
        description: 'Default Goal',
        completed: false,
        project_id: 'default-project',
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
    this.state.goal = {
      description,
      completed: false,
      project_id,
    };
    return this;
  }

  withGoalCompleted(completed: boolean = true): this {
    this.state.goal.completed = completed;
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

  withCurrentTask(task: Task): this {
    this.state.current_task = task;
    return this;
  }

  withHaltReason(reason: string, details?: string): this {
    this.state.supervisor.halt_reason = reason;
    this.state.supervisor.halt_details = details;
    return this;
  }

  withExecutionMode(mode: 'AUTO' | 'MANUAL'): this {
    this.state.execution_mode = mode;
    return this;
  }

  build(): SupervisorState {
    this.state.last_updated = new Date().toISOString();
    return JSON.parse(JSON.stringify(this.state)); // Return a deep copy
  }
}
