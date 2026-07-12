import { dispatchToCursor, CursorCLI } from '../../../src/infrastructure/connectors/agents/providers/cursorCLI';
import * as child_process from 'child_process';
import * as path from 'path';
import { EventEmitter } from 'events';

jest.mock('child_process');



describe('cursorCLI', () => {
  const validCwd = path.join(process.cwd(), 'tests');
  let mockSpawn: jest.Mock;

  beforeEach(() => {
    mockSpawn = child_process.spawn as unknown as jest.Mock;
    mockSpawn.mockReset();
  });

  const mockSpawnProcess = (
    stdout: string,
    stderr = '',
    exitCode = 0,
    delayMs = 5
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

  const cursorJsonOutput = (result: string, sessionId: string) =>
    JSON.stringify({
      type: 'result',
      subtype: 'success',
      result,
      session_id: sessionId,
      request_id: 'req-123',
    });

  test('dispatchToCursor spawns without --approve-mcps', async () => {
    mockSpawnProcess(cursorJsonOutput('Hello', 'sess-abc'), '', 0);

    await dispatchToCursor('hi', validCwd);

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const args = mockSpawn.mock.calls[0][1];
    expect(args).not.toContain('--approve-mcps');
    expect(args).toContain('agent');
    expect(args).toContain('--print');
    expect(args).toContain('--force');
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
  });

  test('dispatchToCursor extracts session_id and result from JSON output', async () => {
    mockSpawnProcess(cursorJsonOutput('Hi. How can I help?', '04321230-4c6c-461d-a0f7-fc879db53e07'), '', 0);

    const result = await dispatchToCursor('hi', validCwd);

    expect(result.sessionId).toBe('04321230-4c6c-461d-a0f7-fc879db53e07');
    expect(result.stdout).toContain('Hi. How can I help?');
    expect(result.exitCode).toBe(0);
  });

  test('dispatchToCursor passes --resume when sessionId provided', async () => {
    mockSpawnProcess(cursorJsonOutput('Continued', 'sess-xyz'), '', 0);

    await dispatchToCursor('continue', validCwd, 'auto', 'sess-abc');

    const args = mockSpawn.mock.calls[0][1];
    expect(args).toContain('--resume');
    expect(args).toContain('sess-abc');
  });

  test('dispatchToCursor prepends [Feature: X] when featureId set and no sessionId', async () => {
    mockSpawnProcess(cursorJsonOutput('ok', 's1'), '', 0);

    await dispatchToCursor('task', validCwd, 'auto', undefined, 'my-feature');

    const args = mockSpawn.mock.calls[0][1];
    const promptArg = args[args.length - 1];
    expect(promptArg).toBe('[Feature: my-feature] task');
  });

  test('throws on spawn error (single attempt, no retry)', async () => {
    mockSpawn.mockImplementation(() => {
      const child = new EventEmitter() as any;
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdin = { end: jest.fn() };
      child.pid = 12345;
      setTimeout(() => child.emit('error', new Error('spawn failed')), 5);
      return child;
    });

    await expect(dispatchToCursor('hi', validCwd)).rejects.toThrow('spawn failed');
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  test('throws when cwd is invalid', async () => {
    const invalidCwd = path.join(process.cwd(), 'nonexistent-dir-xyz-123');

    await expect(dispatchToCursor('hi', invalidCwd)).rejects.toThrow();
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  test('CursorCLI.execute delegates to dispatchToCursor', async () => {
    mockSpawnProcess(cursorJsonOutput('delegated', 's3'), '', 0);

    const cli = new CursorCLI('cursor');
    const result = await cli.execute('prompt', validCwd, 'auto', undefined, 'feat');

    expect(mockSpawn).toHaveBeenCalledWith('cursor', expect.any(Array), expect.any(Object));
    expect(result.stdout).toContain('delegated');
  });



});
