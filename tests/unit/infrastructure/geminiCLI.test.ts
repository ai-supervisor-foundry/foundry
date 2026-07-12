import { dispatchToGemini, geminiCLI } from '../../../src/infrastructure/connectors/agents/providers/geminiCLI';
import * as child_process from 'child_process';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';

// Mock child_process and fs/promises
jest.mock('child_process');
jest.mock('fs/promises', () => ({
  stat: jest.fn(),
}));

describe('GeminiCLI / agy integration', () => {
  let mockSpawn: jest.Mock;
  let mockExec: jest.Mock;
  let mockStat: jest.Mock;

  beforeEach(() => {
    mockSpawn = child_process.spawn as unknown as jest.Mock;
    mockExec = child_process.exec as unknown as jest.Mock;
    mockSpawn.mockReset();
    mockExec.mockReset();
    mockStat = fs.stat as jest.Mock;
    mockStat.mockResolvedValue({ isDirectory: () => true });

    delete process.env.AGY_CLI_PATH;
    delete process.env.GEMINI_CLI_PATH;
  });

  const mockSpawnProcess = (
    stdout: string,
    stderr = '',
    exitCode = 0
  ) => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end: jest.fn() };
    child.pid = 12345;

    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        if (stdout) child.stdout.emit('data', Buffer.from(stdout));
        if (stderr) child.stderr.emit('data', Buffer.from(stderr));
        child.emit('close', exitCode);
      });
      return child;
    });

    return child;
  };

  describe('listSessions', () => {
    test('should execute agy --list-sessions and parse output lines', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        const stdout = `
          1. Initial Setup (2 hours ago) [sess-id-abc-1]
          2. Code Review (3 days ago) [sess-id-xyz-2]
        `;
        callback(null, { stdout, stderr: '' });
      });

      const sessions = await geminiCLI.listSessions();

      expect(mockExec).toHaveBeenCalledWith('agy --list-sessions', expect.any(Function));
      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toEqual({
        snippet: 'Initial Setup',
        timeRelative: '2 hours ago',
        sessionId: 'sess-id-abc-1',
      });
      expect(sessions[1]).toEqual({
        snippet: 'Code Review',
        timeRelative: '3 days ago',
        sessionId: 'sess-id-xyz-2',
      });
    });

    test('should honor AGY_CLI_PATH and GEMINI_CLI_PATH env variables', async () => {
      process.env.AGY_CLI_PATH = '/custom/bin/agy';
      mockExec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: '', stderr: '' });
      });

      await geminiCLI.listSessions();
      expect(mockExec).toHaveBeenCalledWith('/custom/bin/agy --list-sessions', expect.any(Function));
    });
  });

  describe('dispatchToGemini', () => {
    const defaultJsonOutput = (content: string, sessionId: string) =>
      JSON.stringify({
        session_id: sessionId,
        content: content,
        stats: {
          models: {
            'gemini-2.5-flash': {
              tokens: { total: 120 },
            },
          },
        },
      });

    test('should spawn agy with --yolo, --output-format json and --include-directories', async () => {
      mockSpawnProcess(defaultJsonOutput('Response text', 'sess-123'), '', 0);

      const result = await dispatchToGemini('test prompt', '/my/project');

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const [cmd, args] = mockSpawn.mock.calls[0];
      expect(cmd).toBe('agy');
      expect(args).toContain('--yolo');
      expect(args).toContain('--output-format');
      expect(args).toContain('json');
      expect(args).toContain('--include-directories');
      expect(args).toContain('/my/project');
      expect(args).toContain('test prompt');

      expect(result.output).toBe('Response text');
      expect(result.sessionId).toBe('sess-123');
      expect(result.usage?.tokens).toBe(120);
      expect(result.exitCode).toBe(0);
    });

    test('should prepend feature tag if sessionId is absent but featureId is present', async () => {
      mockSpawnProcess(defaultJsonOutput('Done', 'sess-new'), '', 0);

      await dispatchToGemini('implement auth', '/my/project', 'auto', undefined, 'feature-auth');

      const args = mockSpawn.mock.calls[0][1];
      const promptArg = args[args.length - 1];
      expect(promptArg).toBe('[Feature: feature-auth]\n\nimplement auth');
    });

    test('should pass -r sessionId when resuming session', async () => {
      mockSpawnProcess(defaultJsonOutput('Done', 'sess-existing'), '', 0);

      await dispatchToGemini('continue work', '/my/project', 'auto', 'sess-existing');

      const args = mockSpawn.mock.calls[0][1];
      expect(args).toContain('-r');
      expect(args).toContain('sess-existing');
    });

    test('should pass --model flag when agentMode is not auto', async () => {
      mockSpawnProcess(defaultJsonOutput('Done', 'sess-model'), '', 0);

      await dispatchToGemini('run logic', '/my/project', 'gemini-2.5-pro');

      const args = mockSpawn.mock.calls[0][1];
      expect(args).toContain('--model');
      expect(args).toContain('gemini-2.5-pro');
    });

    test('should return FAILED status on non-zero exit code', async () => {
      mockSpawnProcess('', 'Command not found', 127);

      const result = await dispatchToGemini('prompt', '/my/project');

      expect(result.exitCode).toBe(127);
      expect(result.status).toBe('FAILED');
    });

    test('should reject on invalid working directory (not a directory)', async () => {
      mockStat.mockResolvedValue({ isDirectory: () => false });

      await expect(dispatchToGemini('prompt', '/invalid/path')).rejects.toThrow('cwd is not a directory');
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });
});
