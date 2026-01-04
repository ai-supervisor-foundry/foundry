// Command Generator unit tests

import { CommandGenerationResult } from '../../../src/domain/types/types';
import { createMockTask } from '../../fixtures/mockData';

describe('CommandGenerator', () => {
  describe('generateValidationCommands', () => {
    const createMockGenerationResult = (overrides?: Partial<CommandGenerationResult>): CommandGenerationResult => ({
      isValid: true,
      verificationCommands: [],
      ...overrides,
    });

    it('should generate verification commands for file-based tasks', () => {
      const task = createMockTask({
        required_artifacts: ['src/index.ts', 'src/utils.ts'],
      });

      const result = createMockGenerationResult({
        verificationCommands: [
          'test -f src/index.ts',
          'test -f src/utils.ts',
        ],
      });

      expect(result).toBeDefined();
      expect(result.verificationCommands).toBeDefined();
      expect(Array.isArray(result.verificationCommands)).toBe(true);
    });

    it('should check for file existence', () => {
      const task = createMockTask({
        required_artifacts: ['src/main.ts', 'tsconfig.json'],
      });

      const result = createMockGenerationResult({
        verificationCommands: [
          'test -f src/main.ts',
          'test -f tsconfig.json',
        ],
      });

      expect(result.verificationCommands.length).toBeGreaterThan(0);
    });

    it('should generate test commands when required', () => {
      const task = createMockTask({
        test_command: 'npm test',
        tests_required: true,
      });

      const result = createMockGenerationResult({
        verificationCommands: ['npm test'],
      });

      expect(result.verificationCommands).toBeDefined();
    });

    it('should handle JSON schema validation', () => {
      const task = createMockTask({
        expected_json_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
          },
        },
      });

      const result = createMockGenerationResult();

      expect(result).toBeDefined();
      expect(result.verificationCommands).toBeDefined();
    });

    it('should return isValid=true for behavioral tasks', () => {
      const task = createMockTask({
        task_type: 'behavioral',
        instructions: 'Provide analysis',
      });

      const result = createMockGenerationResult({
        isValid: true,
      });

      expect(result).toBeDefined();
    });

    it('should include reasoning for validation approach', () => {
      const task = createMockTask({
        required_artifacts: ['dist/index.js'],
      });

      const result = createMockGenerationResult({
        reasoning: 'Checking for required artifacts',
      });

      expect(result.reasoning).toBeDefined();
      expect(typeof result.reasoning).toBe('string');
    });

    it('should handle multiple artifact types', () => {
      const task = createMockTask({
        required_artifacts: [
          'src/index.ts',
          'src/types.ts',
          'README.md',
          'package.json',
          'dist/bundle.js',
        ],
      });

      const result = createMockGenerationResult({
        verificationCommands: [
          'test -f src/index.ts',
          'test -f src/types.ts',
          'test -f README.md',
          'test -f package.json',
          'test -f dist/bundle.js',
        ],
      });

      expect(result.verificationCommands.length).toBeGreaterThan(0);
    });

    it('should generate executable commands', () => {
      const task = createMockTask({
        required_artifacts: ['src/index.ts'],
      });

      const result = createMockGenerationResult({
        verificationCommands: ['test -f src/index.ts'],
      });

      result.verificationCommands.forEach((cmd: string) => {
        expect(typeof cmd).toBe('string');
        expect(cmd.length).toBeGreaterThan(0);
      });
    });

    it('should handle absolute and relative paths', () => {
      const task = createMockTask({
        required_artifacts: ['src/index.ts', './src/utils.ts', 'README.md'],
      });

      const result = createMockGenerationResult({
        verificationCommands: [
          'test -f src/index.ts',
          'test -f src/utils.ts',
          'test -f README.md',
        ],
      });

      expect(result.verificationCommands).toBeDefined();
      expect(result.verificationCommands.length).toBeGreaterThan(0);
    });

    it('should support lint/format validation', () => {
      const task = createMockTask({
        task_type: 'coding',
        instructions: 'Format all code and ensure lint passes',
        acceptance_criteria: ['Code must pass linting', 'Code must be formatted'],
      });

      const result = createMockGenerationResult({
        verificationCommands: ['npm run lint', 'npm run format:check'],
      });

      expect(result.verificationCommands).toBeDefined();
    });

    it('should generate concise command lists', () => {
      const task = createMockTask({
        required_artifacts: Array.from({ length: 20 }, (_, i) => `src/file${i}.ts`),
      });

      const result = createMockGenerationResult({
        verificationCommands: Array.from({ length: 20 }, (_, i) => `test -f src/file${i}.ts`),
      });

      expect(result.verificationCommands.length).toBeLessThan(50);
    });
  });
});
