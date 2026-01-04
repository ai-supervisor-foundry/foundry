import { detectRecoveryScenario, handleRecoveryScenario, RecoveryScenario } from '../../../src/domain/executors/recovery';
import { SupervisorState, Task } from '../../../src/domain/types/types';
import { ProviderResult } from '../../../src/domain/executors/haltDetection';
import { createMockState, createMockTask } from '../../fixtures/mockData';

describe('Recovery', () => {
  describe('detectRecoveryScenario', () => {
    describe('CLI_CRASH detection', () => {
      it('should detect CLI crash when exit code is non-zero with no output', () => {
        const state = createMockState();
        const result: ProviderResult = {
          stdout: '',
          stderr: '',
          exitCode: 1,
          rawOutput: '',
        };

        const detection = detectRecoveryScenario(state, null, result);

        expect(detection.scenario).toBe('CLI_CRASH');
        expect(detection.details).toContain('exited with code 1');
        expect(detection.details).toContain('no output');
      });

      it('should detect CLI crash during task execution', () => {
        const task = createMockTask({ task_id: 'task-001', status: 'in_progress' });
        const state = createMockState({
          supervisor: {
            status: 'RUNNING',
            last_task_id: 'task-001',
          },
        });
        const result: ProviderResult = {
          stdout: '',
          stderr: 'Segmentation fault',
          exitCode: 139,
          rawOutput: 'Segmentation fault',
        };

        const detection = detectRecoveryScenario(state, task, result);

        expect(detection.scenario).toBe('CLI_CRASH');
        expect(detection.details).toContain('task-001');
      });

      it('should not detect crash when exit code is 0', () => {
        const state = createMockState();
        const result: ProviderResult = {
          stdout: '{"status": "success"}',
          stderr: '',
          exitCode: 0,
          rawOutput: '{"status": "success"}',
        };

        const detection = detectRecoveryScenario(state, null, result);

        expect(detection.scenario).not.toBe('CLI_CRASH');
      });

      it('should not detect crash when non-zero exit but has output', () => {
        const state = createMockState();
        const result: ProviderResult = {
          stdout: 'Error: validation failed',
          stderr: '',
          exitCode: 1,
          rawOutput: 'Error: validation failed',
        };

        const detection = detectRecoveryScenario(state, null, result);

        expect(detection.scenario).not.toBe('CLI_CRASH');
      });
    });

    describe('PARTIAL_TASK detection', () => {
      it('should detect partial task when some rules passed and some failed', () => {
        const task = createMockTask({ task_id: 'task-001', status: 'in_progress' });
        const state = createMockState({
          supervisor: {
            status: 'RUNNING',
            last_task_id: 'task-001',
            last_validation_report: {
              valid: false,
              rules_passed: ['File exists', 'Function defined'],
              rules_failed: ['Tests passing', 'Documentation complete'],
              confidence: 'LOW',
            },
          },
        });

        const detection = detectRecoveryScenario(state, task, null);

        expect(detection.scenario).toBe('PARTIAL_TASK');
        expect(detection.details).toContain('2 rules passed');
        expect(detection.details).toContain('2 failed');
      });

      it('should detect partial task when task is in_progress but not completed', () => {
        const task = createMockTask({ task_id: 'task-002', status: 'in_progress' });
        const state = createMockState({
          supervisor: {
            status: 'RUNNING',
            last_task_id: 'task-002',
          },
          completed_tasks: [],
        });

        const detection = detectRecoveryScenario(state, task, null);

        expect(detection.scenario).toBe('PARTIAL_TASK');
        expect(detection.details).toContain('in progress but never completed');
      });

      it('should not detect partial task when all rules failed', () => {
        const task = createMockTask({ task_id: 'task-001' });
        const state = createMockState({
          supervisor: {
            status: 'RUNNING',
            last_task_id: 'task-001',
            last_validation_report: {
              valid: false,
              rules_passed: [],
              rules_failed: ['File exists', 'Tests passing'],
              confidence: 'LOW',
            },
          },
        });

        const detection = detectRecoveryScenario(state, task, null);

        expect(detection.scenario).not.toBe('PARTIAL_TASK');
      });

      it('should not detect partial task when all rules passed', () => {
        const task = createMockTask({ task_id: 'task-001' });
        const state = createMockState({
          supervisor: {
            status: 'RUNNING',
            last_task_id: 'task-001',
            last_validation_report: {
              valid: true,
              rules_passed: ['File exists', 'Tests passing'],
              rules_failed: [],
              confidence: 'HIGH',
            },
          },
        });

        const detection = detectRecoveryScenario(state, task, null);

        expect(detection.scenario).not.toBe('PARTIAL_TASK');
      });
    });

    describe('CONFLICTING_STATE detection', () => {
      it('should detect conflicting state when RUNNING but queue exhausted with incomplete goal', () => {
        const state = createMockState({
          supervisor: {
            status: 'RUNNING',
          },
          current_task: undefined,
          queue: {
            exhausted: true,
          },
          goal: {
            completed: false,
            description: 'Build the feature',
          },
        });

        const detection = detectRecoveryScenario(state, null, null);

        expect(detection.scenario).toBe('CONFLICTING_STATE');
        expect(detection.details).toContain('RUNNING but queue is exhausted');
      });

      it('should detect conflicting state when halt_reason exists but status is not HALTED', () => {
        const state = createMockState({
          supervisor: {
            status: 'RUNNING',
            halt_reason: 'ASKED_QUESTION',
          },
        });

        const detection = detectRecoveryScenario(state, null, null);

        expect(detection.scenario).toBe('CONFLICTING_STATE');
        expect(detection.details).toContain('halt_reason but status is RUNNING');
      });

      it('should not detect conflicting state when RUNNING with current task', () => {
        const task = createMockTask({ task_id: 'task-001' });
        const state = createMockState({
          supervisor: {
            status: 'RUNNING',
          },
          current_task: task,
          queue: {
            exhausted: false,
          },
        });

        const detection = detectRecoveryScenario(state, task, null);

        expect(detection.scenario).not.toBe('CONFLICTING_STATE');
      });

      it('should not detect conflicting state when HALTED with halt_reason', () => {
        const state = createMockState({
          supervisor: {
            status: 'HALTED',
            halt_reason: 'ASKED_QUESTION',
          },
        });

        const detection = detectRecoveryScenario(state, null, null);

        expect(detection.scenario).not.toBe('CONFLICTING_STATE');
      });
    });

    describe('NONE scenario', () => {
      it('should return NONE when no recovery scenarios detected', () => {
        const state = createMockState({
          supervisor: {
            status: 'RUNNING',
          },
        });
        const result: ProviderResult = {
          stdout: '{"status": "success"}',
          stderr: '',
          exitCode: 0,
          rawOutput: '{"status": "success"}',
        };

        const detection = detectRecoveryScenario(state, null, result);

        expect(detection.scenario).toBe('NONE');
        expect(detection.details).toBeUndefined();
      });

      it('should return NONE for COMPLETED status', () => {
        const state = createMockState({
          supervisor: {
            status: 'COMPLETED',
          },
          goal: {
            completed: true,
            description: 'Build the feature',
          },
        });

        const detection = detectRecoveryScenario(state, null, null);

        expect(detection.scenario).toBe('NONE');
      });
    });

    describe('Edge cases', () => {
      it('should handle null provider result gracefully', () => {
        const state = createMockState();
        const detection = detectRecoveryScenario(state, null, null);
        expect(detection).toBeDefined();
        expect(detection.scenario).toBeDefined();
      });

      it('should handle null last task gracefully', () => {
        const state = createMockState();
        const result: ProviderResult = {
          stdout: '',
          stderr: '',
          exitCode: 0,
          rawOutput: '',
        };
        const detection = detectRecoveryScenario(state, null, result);
        expect(detection).toBeDefined();
      });

      it('should prioritize CLI_CRASH over other scenarios', () => {
        const task = createMockTask({ task_id: 'task-001', status: 'in_progress' });
        const state = createMockState({
          supervisor: {
            status: 'RUNNING',
            last_task_id: 'task-001',
            last_validation_report: {
              valid: false,
              rules_passed: ['Rule 1'],
              rules_failed: ['Rule 2'],
              confidence: 'LOW',
            },
          },
        });
        const result: ProviderResult = {
          stdout: '',
          stderr: '',
          exitCode: 1,
          rawOutput: '',
        };

        const detection = detectRecoveryScenario(state, task, result);

        expect(detection.scenario).toBe('CLI_CRASH');
      });
    });
  });

  describe('handleRecoveryScenario', () => {
    describe('CLI_CRASH handling', () => {
      it('should recommend automatic recovery for CLI crash', () => {
        const detection = { scenario: 'CLI_CRASH' as RecoveryScenario, details: 'CLI crashed' };
        const state = createMockState();

        const result = handleRecoveryScenario(detection, state);

        expect(result.action).toContain('Reload');
        expect(result.action).toContain('reissue last task');
        expect(result.requiresOperatorInput).toBe(false);
      });
    });

    describe('PARTIAL_TASK handling', () => {
      it('should recommend operator input for partial task', () => {
        const detection = { scenario: 'PARTIAL_TASK' as RecoveryScenario, details: 'Partial completion' };
        const state = createMockState();

        const result = handleRecoveryScenario(detection, state);

        expect(result.action).toContain('blocked');
        expect(result.action).toContain('operator input');
        expect(result.requiresOperatorInput).toBe(true);
      });
    });

    describe('CONFLICTING_STATE handling', () => {
      it('should recommend operator resolution for conflicting state', () => {
        const detection = { scenario: 'CONFLICTING_STATE' as RecoveryScenario, details: 'State conflict' };
        const state = createMockState();

        const result = handleRecoveryScenario(detection, state);

        expect(result.action).toContain('Halt');
        expect(result.action).toContain('operator resolution');
        expect(result.requiresOperatorInput).toBe(true);
      });
    });

    describe('NONE handling', () => {
      it('should indicate no recovery needed', () => {
        const detection = { scenario: 'NONE' as RecoveryScenario };
        const state = createMockState();

        const result = handleRecoveryScenario(detection, state);

        expect(result.action).toContain('No recovery needed');
        expect(result.requiresOperatorInput).toBe(false);
      });
    });

    describe('Action consistency', () => {
      it('should always return an action and requiresOperatorInput flag', () => {
        const scenarios: RecoveryScenario[] = ['CLI_CRASH', 'PARTIAL_TASK', 'CONFLICTING_STATE', 'NONE'];
        const state = createMockState();

        scenarios.forEach(scenario => {
          const detection = { scenario, details: `Test ${scenario}` };
          const result = handleRecoveryScenario(detection, state);

          expect(result.action).toBeDefined();
          expect(typeof result.action).toBe('string');
          expect(result.action.length).toBeGreaterThan(0);
          expect(typeof result.requiresOperatorInput).toBe('boolean');
        });
      });

      it('should provide different actions for different scenarios', () => {
        const state = createMockState();
        const actions = new Set<string>();

        const scenarios: RecoveryScenario[] = ['CLI_CRASH', 'PARTIAL_TASK', 'CONFLICTING_STATE', 'NONE'];
        scenarios.forEach(scenario => {
          const detection = { scenario };
          const result = handleRecoveryScenario(detection, state);
          actions.add(result.action);
        });

        expect(actions.size).toBe(4); // Each scenario should have unique action
      });
    });
  });
});
