
import { buildFixPrompt, buildPrompt, buildMinimalState, validateFilePaths } from '../../../src/domain/agents/promptBuilder';
import { Task, SupervisorState } from '../../../src/domain/types/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('../../../src/infrastructure/adapters/logging/logger');

describe('Prompt Tightening Verification', () => {
  const sandboxRoot = path.join(__dirname, '../../tmp/test-sandbox');

  beforeAll(() => {
    if (!fs.existsSync(sandboxRoot)) {
      fs.mkdirSync(sandboxRoot, { recursive: true });
    }
    // Create a dummy file for snippet testing
    fs.writeFileSync(path.join(sandboxRoot, 'broken.ts'), 'export const x = 1;\n// This is a test file\nconsole.log(x);');
  });

  afterAll(() => {
    if (fs.existsSync(sandboxRoot)) {
      fs.rmSync(sandboxRoot, { recursive: true, force: true });
    }
  });

  const mockTask: Task = {
    task_id: 'test-task',
    intent: 'fix the bug',
    instructions: 'Fix the export in broken.ts',
    acceptance_criteria: ['x should be 2'],
    tool: 'gemini' as any,
    status: 'in_progress'
  };

  const mockState: SupervisorState = {
    supervisor: { status: 'RUNNING', iteration: 1 },
    goal: { description: 'test goal', completed: false, project_id: 'test-p' },
    queue: { exhausted: false },
    last_updated: new Date().toISOString(),
    execution_mode: 'AUTO'
  };

  describe('Content Snippets (buildFixPrompt)', () => {
    it('should inject file snippets when a path is found in failed rules', () => {
      const validationReport = {
        rules_failed: ['File broken.ts should contain x = 2'],
        rules_passed: []
      };
      const minimalState = buildMinimalState(mockTask, mockState, sandboxRoot);
      const prompt = buildFixPrompt(mockTask, minimalState, validationReport);

      expect(prompt).toContain('### Contextual File Content');
      expect(prompt).toContain('File: broken.ts (first 3 lines)');
      expect(prompt).toContain('export const x = 1;');
    });

    it('should NOT inject snippets for non-existent files', () => {
      const validationReport = {
        rules_failed: ['File ghost.ts is missing'],
        rules_passed: []
      };
      const minimalState = buildMinimalState(mockTask, mockState, sandboxRoot);
      const prompt = buildFixPrompt(mockTask, minimalState, validationReport);

      expect(prompt).not.toContain('File: ghost.ts');
    });
  });

  describe('Consolidated Rules', () => {
    it('should contain the "Check READ-ONLY CONTEXT first" instruction in all prompts', () => {
      const minimalState = buildMinimalState(mockTask, mockState, sandboxRoot);
      
      const prompt = buildPrompt(mockTask, minimalState);
      const fixPrompt = buildFixPrompt(mockTask, minimalState, { rules_failed: [], rules_passed: [] });
      
      const expectedRule = 'Check READ-ONLY CONTEXT (project structure, previous tasks) first';
      
      expect(prompt).toContain(expectedRule);
      expect(fixPrompt).toContain(expectedRule);
    });
  });

  describe('Path Validation (Sanity Check)', () => {
    it('should filter absolute paths', () => {
      const paths = ['relative/file.ts', '/absolute/path.ts', 'other/file.ts'];
      const filtered = validateFilePaths(paths, sandboxRoot);
      expect(filtered).not.toContain('/absolute/path.ts');
    });
  });
});
