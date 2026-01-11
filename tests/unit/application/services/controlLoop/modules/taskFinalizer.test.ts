import { TaskFinalizer } from '../../../../../../src/application/services/controlLoop/modules/taskFinalizer';
import { SupervisorState, Task, ValidationReport } from '../../../../../../src/domain/types/types';
import { PersistencePort } from '../../../../../../src/domain/ports/persistence';
import { AuditLogPort } from '../../../../../../src/domain/ports/auditLog';
import { LoggerPort } from '../../../../../../src/domain/ports/logger';
import { Provider } from '../../../../../../src/domain/agents/enums/provider';

describe('TaskFinalizer', () => {
  let finalizer: TaskFinalizer;
  let mockPersistence: jest.Mocked<PersistencePort>;
  let mockAuditLogger: jest.Mocked<AuditLogPort>;
  let mockLogger: jest.Mocked<LoggerPort>;

  beforeEach(() => {
    mockPersistence = {
      readState: jest.fn(),
      writeState: jest.fn(),
    };
    mockAuditLogger = {
      appendAuditLog: jest.fn(),
      append: jest.fn(),
    };
    mockLogger = {
      log: jest.fn(),
      logError: jest.fn(),
      logPerformance: jest.fn(),
      logStateTransition: jest.fn(),
    } as any;

    finalizer = new TaskFinalizer(mockPersistence, mockAuditLogger, mockLogger);
  });

  it('should capture intent and summary', async () => {
    const task: Task = {
      task_id: 'task-1',
      intent: 'Fix the bug. Make it work.',
      tool: Provider.GEMINI,
      instructions: 'Fix it',
      acceptance_criteria: [],
      status: 'in_progress',
    };
    
    const report: ValidationReport = {
      valid: true,
      rules_passed: [],
      rules_failed: [],
    };
    
    const state: SupervisorState = {
      supervisor: { status: 'RUNNING' },
      completed_tasks: [],
    } as any;

    await finalizer.finalizeTask(state, {
      stateBefore: { ...state },
      task,
      validationReport: report,
      sandboxRoot: '/tmp',
      projectId: 'test',
      iteration: 1,
      finalPrompt: '',
      finalResponse: '',
    });

    expect(state.completed_tasks).toHaveLength(1);
    expect(state.completed_tasks?.[0].intent).toBe('Fix the bug. Make it work.');
    expect(state.completed_tasks?.[0].summary).toBe('Completed: Fix the bug');
    expect(state.completed_tasks?.[0].requires_context).toBe(true);
  });

  it('should prune completed tasks to 100', async () => {
    const tasks = Array.from({ length: 150 }, (_, i) => ({
      task_id: `task-${i}`,
      completed_at: new Date().toISOString(),
      validation_report: { valid: true, rules_passed: [], rules_failed: [] },
      intent: `Task ${i}`,
    }));

    const state: SupervisorState = {
      supervisor: { status: 'RUNNING' },
      completed_tasks: [...tasks],
    } as any;

    const task: Task = {
        task_id: 'new-task',
        intent: 'New Task',
        tool: Provider.GEMINI,
        instructions: 'Do it',
        acceptance_criteria: [],
        status: 'in_progress'
    };
    
    const report: ValidationReport = { valid: true, rules_passed: [], rules_failed: [] };

    await finalizer.finalizeTask(state, {
        stateBefore: { ...state },
        task,
        validationReport: report,
        sandboxRoot: '/tmp',
        projectId: 'test',
        iteration: 1,
        finalPrompt: '',
        finalResponse: '',
    });

    expect(state.completed_tasks).toHaveLength(100);
    expect(state.completed_tasks?.[99].task_id).toBe('new-task'); // The newest one is last
    // The list starts at index 51 (task-51) because 0-50 are pruned (51 items removed + new item added? No.)
    // Original: 0..149 (150 items).
    // Add 1: 0..149, new (151 items).
    // Keep last 100: indices 51..149 + new.
    // tasks[51] is task-51.
    expect(state.completed_tasks?.[0].task_id).toBe('task-51');
  });
});
