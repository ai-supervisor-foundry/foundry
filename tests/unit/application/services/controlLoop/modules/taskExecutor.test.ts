import { TaskExecutor } from '../../../../../../src/application/services/controlLoop/modules/taskExecutor';
import { TaskBuilder } from '@helpers/task-builders';
import { StateBuilder } from '@helpers/state-builders';
import { LLMProviderPort } from '../../../../../../src/domain/ports/llmProvider';
import { LoggerPort, PromptLoggerPort } from '../../../../../../src/domain/ports/logger';
import { PromptBuilder } from '../../../../../../src/domain/agents/promptBuilder';
import { SessionResolver } from '../../../../../../src/application/services/controlLoop/modules/sessionResolver';
import { Provider } from '../../../../../../src/domain/agents/enums/provider';

describe('TaskExecutor', () => {
  let executor: TaskExecutor;
  let mockCliAdapter: jest.Mocked<LLMProviderPort>;
  let mockLogger: jest.Mocked<LoggerPort>;
  let mockPromptLogger: jest.Mocked<PromptLoggerPort>;
  let mockPromptBuilder: jest.Mocked<PromptBuilder>;
  let mockSessionResolver: jest.Mocked<SessionResolver>;
  const sandboxRoot = '/tmp/sandbox';

  beforeEach(() => {
    mockCliAdapter = {
      execute: jest.fn().mockResolvedValue({
        exitCode: 0,
        stdout: 'done',
        stderr: '',
        rawOutput: 'done',
      }),
      getProviderInUse: jest.fn().mockReturnValue(Provider.CURSOR),
    };

    mockLogger = {
      log: jest.fn(),
      logVerbose: jest.fn(),
      logPerformance: jest.fn(),
      logStateTransition: jest.fn(),
      logError: jest.fn(),
    };

    mockPromptLogger = {
      appendPromptLog: jest.fn().mockResolvedValue(undefined),
    };

    mockPromptBuilder = {
      buildMinimalSnapshot: jest.fn().mockReturnValue({
        project: { id: 'test-project', sandbox_root: sandboxRoot },
      }),
      buildTaskPrompt: jest.fn(),
    } as any;

    mockSessionResolver = {
      resolveSession: jest.fn().mockResolvedValue(undefined),
      getFeatureId: jest.fn().mockReturnValue('feat-1'),
    } as any;

    executor = new TaskExecutor(
      mockPromptBuilder,
      mockCliAdapter,
      mockLogger,
      mockPromptLogger,
      sandboxRoot
    );
  });

  describe('working directory resolution', () => {
    it('should use task.project_id for CWD when no working_directory override', async () => {
      const task = TaskBuilder.simple('t1', 'Do something')
        .withProjectId('my-project')
        .build();

      const state = StateBuilder.running().build();

      await executor.executeTask(task, state, 1, mockSessionResolver);

      expect(mockCliAdapter.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/\/my-project$/),
        expect.any(String),
        undefined,
        'feat-1'
      );
    });

    it('should use working_directory when provided (overrides project_id)', async () => {
      const task = TaskBuilder.simple('t2', 'Do something else')
        .withProjectId('my-project')
        .build();
      task.working_directory = 'custom/path';

      const state = StateBuilder.running().build();

      await executor.executeTask(task, state, 1, mockSessionResolver);

      expect(mockCliAdapter.execute).toHaveBeenCalledWith(
        expect.any(String),
        `${sandboxRoot}/custom/path`,
        expect.any(String),
        undefined,
        'feat-1'
      );
    });

    it('should pass correct projectId to prompt logger', async () => {
      const task = TaskBuilder.simple('t3', 'Log check')
        .withProjectId('logger-project')
        .build();

      const state = StateBuilder.running().build();

      await executor.executeTask(task, state, 1, mockSessionResolver);

      // Prompt logger is called twice: once for PROMPT, once for RESPONSE
      expect(mockPromptLogger.appendPromptLog).toHaveBeenCalledWith(
        sandboxRoot,
        'logger-project',
        expect.objectContaining({
          task_id: 't3',
          type: 'PROMPT',
        })
      );

      expect(mockPromptLogger.appendPromptLog).toHaveBeenCalledWith(
        sandboxRoot,
        'logger-project',
        expect.objectContaining({
          task_id: 't3',
          type: 'RESPONSE',
        })
      );
    });
  });
});
