import { Task, Project } from '../../../src/domain/types/types';
import { Provider } from '../../../src/domain/agents/enums/provider';

describe('Per-task project_id', () => {
  describe('Task interface', () => {
    it('should require project_id', () => {
      const task: Task = {
        task_id: 'task-1',
        project_id: 'my-project',
        intent: 'Test intent',
        tool: Provider.CURSOR,
        instructions: 'Test instructions',
        acceptance_criteria: ['criterion-1'],
        affects_files: ['src/test.ts'],
        status: 'pending',
      };

      // project_id is required — this test confirms the type compiles
      expect(task.project_id).toBe('my-project');
    });

    it('should be valid with project_id set', () => {
      const task: Task = {
        task_id: 'task-2',
        project_id: 'another-project',
        intent: 'Another intent',
        tool: Provider.GEMINI,
        instructions: 'Do something',
        acceptance_criteria: ['done'],
        affects_files: ['src/test.ts'],
        status: 'in_progress',
      };

      expect(task.project_id).toBeDefined();
      expect(typeof task.project_id).toBe('string');
      expect(task.project_id.length).toBeGreaterThan(0);
    });
  });

  describe('Project interface', () => {
    it('should have correct shape', () => {
      const project: Project = {
        id: 'proj-1',
        name: 'My Project',
        path: 'my-project',
        registered_at: '2025-01-01T00:00:00Z',
        status: 'active',
      };

      expect(project.id).toBe('proj-1');
      expect(project.name).toBe('My Project');
      expect(project.path).toBe('my-project');
      expect(project.registered_at).toBe('2025-01-01T00:00:00Z');
      expect(project.status).toBe('active');
    });
  });
});
