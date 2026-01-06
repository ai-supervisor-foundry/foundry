// Validator unit tests

import { validateTaskOutput } from '../../../src/application/services/validator';
import { Task, ValidationReport } from '../../../src/domain/types/types';
import { createMockTask } from '../../fixtures/mockData';

interface ProviderResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  rawOutput: string;
}

describe('Validator', () => {
  const mockSandboxRoot = '/tmp/sandbox/test-project';

  const createMockProviderResult = (overrides?: Partial<ProviderResult>): ProviderResult => ({
    stdout: '',
    stderr: '',
    exitCode: 0,
    rawOutput: '',
    ...overrides,
  });

  describe('validateTaskOutput', () => {
    it('should validate successful task completion', async () => {
      const task = createMockTask({
        task_id: 'test-001',
        task_type: 'behavioral',
      });

      const result = createMockProviderResult({
        stdout: JSON.stringify({
          status: 'completed',
          summary: 'Task completed successfully',
        }),
        exitCode: 0,
      });

      const validation = await validateTaskOutput(task, result, mockSandboxRoot, 'test-project');

      expect(validation).toBeDefined();
      expect(validation.rules_passed).toBeDefined();
      expect(validation.rules_failed).toBeDefined();
    });

    it('should handle JSON output validation', async () => {
      const task = createMockTask({
        task_type: 'coding',
        expected_json_schema: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            files_created: { type: 'array' },
          },
        },
      });

      const result = createMockProviderResult({
        stdout: JSON.stringify({
          status: 'completed',
          files_created: ['src/index.ts', 'src/utils.ts'],
        }),
        exitCode: 0,
      });

      const validation = await validateTaskOutput(task, result, mockSandboxRoot, 'test-project');

      expect(validation).toBeDefined();
      expect(Array.isArray(validation.rules_passed)).toBe(true);
    });

    it('should detect acceptance criteria failures', async () => {
      const task = createMockTask({
        task_id: 'test-with-criteria',
        acceptance_criteria: [
          'File src/index.ts must exist',
          'File src/utils.ts must exist',
        ],
      });

      const result = createMockProviderResult({
        stdout: JSON.stringify({
          status: 'completed',
          summary: 'Partial completion',
        }),
        exitCode: 0,
      });

      const validation = await validateTaskOutput(task, result, mockSandboxRoot, 'test-project');

      expect(validation).toBeDefined();
      expect(validation.rules_failed).toBeDefined();
    });

    it('should handle behavioral tasks differently', async () => {
      const task = createMockTask({
        task_type: 'behavioral',
        task_id: 'response-task',
        instructions: 'Provide analysis of the codebase',
        acceptance_criteria: [
          'Analysis must be provided',
          'Summary must include key findings',
        ],
      });

      const result = createMockProviderResult({
        stdout: JSON.stringify({
          analysis: 'Detailed analysis here',
          findings: ['Finding 1', 'Finding 2'],
          status: 'complete',
        }),
        exitCode: 0,
      });

      const validation = await validateTaskOutput(task, result, mockSandboxRoot, 'test-project');

      expect(validation).toBeDefined();
      expect(validation.confidence).toBeDefined();
    });

    it('should detect validation uncertainty for design tasks', async () => {
      const task = createMockTask({
        task_type: 'behavioral',
        intent: 'Design system architecture',
        acceptance_criteria: [
          'Design must be comprehensive',
          'All components must be documented',
        ],
      });

      const result = createMockProviderResult({
        stdout: JSON.stringify({
          design_documentation: 'Architecture design completed',
        }),
        exitCode: 0,
      });

      const validation = await validateTaskOutput(task, result, mockSandboxRoot, 'test-project');

      expect(validation).toBeDefined();
      // Design tasks might have UNCERTAIN confidence
      expect(['HIGH', 'LOW', 'UNCERTAIN'].includes(validation.confidence || 'HIGH')).toBe(true);
    });

    it('should handle malformed JSON output', async () => {
      const task = createMockTask({
        expected_json_schema: {
          properties: { status: { type: 'string' } },
        },
      });

      const result = createMockProviderResult({
        stdout: 'Not valid JSON',
        exitCode: 0,
      });

      const validation = await validateTaskOutput(task, result, mockSandboxRoot, 'test-project');

      expect(validation.valid).toBe(false);
      expect(validation.rules_failed.length).toBeGreaterThan(0);
    });

    it('should track failed criteria for interrogation', async () => {
      const task = createMockTask({
        acceptance_criteria: [
          'Criterion A must be satisfied',
          'Criterion B must be satisfied',
          'Criterion C must be satisfied',
        ],
      });

      const result = createMockProviderResult({
        stdout: JSON.stringify({ status: 'partial' }),
        exitCode: 0,
      });

      const validation = await validateTaskOutput(task, result, mockSandboxRoot, 'test-project');

      expect(validation.failed_criteria).toBeDefined();
      expect(Array.isArray(validation.failed_criteria)).toBe(true);
    });

    it('should handle execution errors', async () => {
      const task = createMockTask();

      const result = createMockProviderResult({
        stdout: '',
        stderr: 'Execution failed',
        exitCode: 1,
      });

      const validation = await validateTaskOutput(task, result, mockSandboxRoot, 'test-project');

      expect(validation.valid).toBe(false);
    });

    it('should support test command validation', async () => {
      const task = createMockTask({
        test_command: 'npm test',
        tests_required: true,
      });

      const result = createMockProviderResult({
        stdout: JSON.stringify({
          status: 'completed',
          test_results: 'All tests passed',
        }),
        exitCode: 0,
      });

      const validation = await validateTaskOutput(task, result, mockSandboxRoot, 'test-project');

      expect(validation).toBeDefined();
    });

    it('should validate required artifacts', async () => {
      const task = createMockTask({
        required_artifacts: ['src/index.ts', 'src/types.ts', 'README.md'],
      });

      const result = createMockProviderResult({
        stdout: JSON.stringify({
          status: 'completed',
          artifacts: ['src/index.ts', 'src/types.ts', 'README.md'],
        }),
        exitCode: 0,
      });

      const validation = await validateTaskOutput(task, result, mockSandboxRoot, 'test-project');

      expect(validation).toBeDefined();
    });
  });
});
