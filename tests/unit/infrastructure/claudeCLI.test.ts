import { dispatchToClaude } from '../../../src/infrastructure/connectors/agents/providers/claudeCLI';
import * as nodePty from 'node-pty';
import * as fs from 'fs/promises';

jest.mock('node-pty');
jest.mock('fs/promises', () => ({
  stat: jest.fn(),
}));



describe('ClaudeCLI - dispatchToClaude', () => {
  let mockPtySpawn: jest.Mock;
  let mockStat: jest.Mock;

  beforeEach(() => {
    mockPtySpawn = nodePty.spawn as unknown as jest.Mock;
    mockPtySpawn.mockReset();
    mockStat = fs.stat as jest.Mock;
    mockStat.mockResolvedValue({ isDirectory: () => true });
    delete process.env.CLAUDE_CLI_PATH;
  });

  const mockPtyProcess = (output: string, exitCode: number = 0) => {
    const dataHandlers: ((data: string) => void)[] = [];
    const exitHandlers: ((e: { exitCode: number }) => void)[] = [];

    const fakePty = {
      pid: 99999,
      onData: jest.fn((cb) => { dataHandlers.push(cb); }),
      onExit: jest.fn((cb) => { exitHandlers.push(cb); }),
      kill: jest.fn(),
    };

    mockPtySpawn.mockReturnValue(fakePty);

    setTimeout(() => {
      dataHandlers.forEach(cb => cb(output));
      exitHandlers.forEach(cb => cb({ exitCode }));
    }, 10);

    return fakePty;
  };

  test('should spawn claude via node-pty (not npx, not bash)', async () => {
    mockPtyProcess('{"result":"PONG"}');

    await dispatchToClaude('test prompt', '/tmp');

    const [cmd, args] = mockPtySpawn.mock.calls[0];
    expect(cmd).toBe('claude');
    expect(args).toContain('--print');
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
    expect(args).toContain('--dangerously-skip-permissions');
    expect(args).toContain('test prompt');
    expect(args).not.toContain('npx');
    expect(args).not.toContain('@anthropic-ai/claude-code');
    expect(args).not.toContain('bash');
  });

  test('should use CLAUDE_CLI_PATH when set', async () => {
    process.env.CLAUDE_CLI_PATH = '/custom/claude';
    mockPtyProcess('ok');

    await dispatchToClaude('prompt', '/tmp');

    expect(mockPtySpawn.mock.calls[0][0]).toBe('/custom/claude');
  });

  test('should spawn with PTY options (name, cols, rows, cwd)', async () => {
    mockPtyProcess('ok');

    await dispatchToClaude('prompt', '/my/project');

    const opts = mockPtySpawn.mock.calls[0][2];
    expect(opts.name).toBe('xterm-color');
    expect(opts.cols).toBeGreaterThan(0);
    expect(opts.rows).toBeGreaterThan(0);
    expect(opts.cwd).toBe('/my/project');
  });

  test('should add --model when agentMode is not auto', async () => {
    mockPtyProcess('ok');

    await dispatchToClaude('prompt', '/tmp', 'claude-sonnet-4-20250514');

    const args = mockPtySpawn.mock.calls[0][1];
    expect(args).toContain('--model');
    expect(args).toContain('claude-sonnet-4-20250514');
  });

  test('should omit --model when agentMode is auto', async () => {
    mockPtyProcess('ok');

    await dispatchToClaude('prompt', '/tmp', 'auto');

    expect(mockPtySpawn.mock.calls[0][1]).not.toContain('--model');
  });

  test('should add --session-id when provided', async () => {
    mockPtyProcess('ok');

    await dispatchToClaude('prompt', '/tmp', undefined, 'sess-abc');

    const args = mockPtySpawn.mock.calls[0][1];
    expect(args).toContain('--resume');
    expect(args).toContain('sess-abc');
  });

  test('should strip ANSI codes and extract JSON from output', async () => {
    const rawOutput = '\x1B[32m{"result":"PONG"}\x1B[0m\x1B[?25h';
    mockPtyProcess(rawOutput);

    const result = await dispatchToClaude('prompt', '/tmp');

    expect(result.stdout).toBe('{"result":"PONG"}');
    expect(result.rawOutput).toBe(rawOutput);
  });

  test('should return exitCode 0 and no status on success', async () => {
    mockPtyProcess('{"result":"ok"}', 0);

    const result = await dispatchToClaude('prompt', '/tmp');

    expect(result.exitCode).toBe(0);
    expect(result.status).toBeUndefined();
  });

  test('should set status FAILED on non-zero exit', async () => {
    mockPtyProcess('error output', 1);

    const result = await dispatchToClaude('prompt', '/tmp');

    expect(result.exitCode).toBe(1);
    expect(result.status).toBe('FAILED');
  });

  test('should reject when pty.spawn throws', async () => {
    mockPtySpawn.mockImplementation(() => { throw new Error('spawn ENOENT'); });

    await expect(dispatchToClaude('prompt', '/tmp')).rejects.toThrow('Claude CLI process error: spawn ENOENT');
  });

  test('should reject on invalid cwd', async () => {
    mockStat.mockRejectedValue(new Error('ENOENT'));

    await expect(dispatchToClaude('prompt', '/nonexistent')).rejects.toThrow('Invalid cwd: /nonexistent');
  });

  test('should extract session_id from JSON output', async () => {
    mockPtyProcess('{"result":"ok","session_id":"sess-xyz-123"}', 0);

    const result = await dispatchToClaude('prompt', '/tmp');

    expect(result.sessionId).toBe('sess-xyz-123');
  });

  test('should reject when cwd is not a directory', async () => {
    mockStat.mockResolvedValue({ isDirectory: () => false });

    await expect(dispatchToClaude('prompt', '/tmp/file.txt')).rejects.toThrow('cwd is not a directory');
  });



});
