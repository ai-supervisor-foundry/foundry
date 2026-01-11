import { Task, TaskType } from '@/domain/types/types';
import { Provider } from '@/domain/agents/enums/provider';

export class TaskBuilder {
  private task: Task;

  constructor(id: string, intent: string) {
    this.task = {
      task_id: id,
      intent: intent,
      tool: Provider.GEMINI,
      task_type: 'coding',
      instructions: 'Default instructions',
      acceptance_criteria: ['Task must be completed'],
      status: 'pending',
    };
  }

  static simple(id: string, intent: string = 'Simple task'): TaskBuilder {
    return new TaskBuilder(id, intent);
  }

  static coding(id: string, intent: string = 'Coding task'): TaskBuilder {
    return new TaskBuilder(id, intent).withType('coding');
  }

  static behavioral(id: string, intent: string = 'Behavioral task'): TaskBuilder {
    return new TaskBuilder(id, intent).withType('behavioral');
  }

  withType(type: TaskType): this {
    this.task.task_type = type;
    return this;
  }

  withInstructions(instructions: string): this {
    this.task.instructions = instructions;
    return this;
  }

  withCriteria(criteria: string[]): this {
    this.task.acceptance_criteria = criteria;
    return this;
  }

  withStatus(status: Task['status']): this {
    this.task.status = status;
    return this;
  }

  withTool(tool: Provider): this {
    this.task.tool = tool;
    return this;
  }

  withTestCommand(command: string): this {
    this.task.test_command = command;
    this.task.tests_required = true;
    return this;
  }

  build(): Task {
    return JSON.parse(JSON.stringify(this.task));
  }
}
