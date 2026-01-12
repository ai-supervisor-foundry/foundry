import { CopilotCLI } from '../../../src/infrastructure/connectors/agents/providers/copilotCLI';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
jest.mock('child_process');

describe('CopilotCLI', () => {
  let copilotCLI: CopilotCLI;
  let mockSpawn: jest.Mock;

  beforeEach(() => {
    copilotCLI = new CopilotCLI(false);
    mockSpawn = child_process.spawn as unknown as jest.Mock;
    mockSpawn.mockReset();
  });

  const mockSpawnProcess = (stdout: string, stderr: string = '', exitCode: number = 0) => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end: jest.fn() };
    child.pid = 12345; // Add mock PID for logging
    
    mockSpawn.mockReturnValue(child);

    // Simulate process execution
    setTimeout(() => {
      child.stdout.emit('data', Buffer.from(stdout));
      child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', exitCode);
    }, 10);

    return child;
  };

  test('dispatch should spawn process with correct arguments', async () => {
    mockSpawnProcess('success output');

    const result = await copilotCLI.dispatch('test prompt', undefined, { model: 'gpt-4' });

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringContaining('npx'), // or just 'npx'
      expect.arrayContaining([
        '@github/copilot',
        '--model',
        'gpt-4',
        '--allow-all-tools',
        '--silent',
        '--prompt',
        'test prompt'
      ]),
      expect.any(Object)
    );
    expect(result.output).toBe('success output');
  });

  test('dispatch should handle agentMode "auto" by omitting model flag (if logic dictates) or passing undefined', async () => {
    // NOTE: The mapping logic (auto -> undefined) happens in the *caller* (dispatchToCopilot),
    // not in the CopilotCLI.dispatch method itself.
    // However, if we pass explicit undefined to options.model, CopilotCLI should probably use default or omit.
    
    mockSpawnProcess('success');

    // If we pass undefined, existing logic falls back to default in the caller, 
    // but CopilotCLI class might have defaults too. Let's check CopilotCLI behavior.
    // In current impl, CopilotCLI.dispatch checks: if (options.model) args.push('--model', options.model)
    
    await copilotCLI.dispatch('prompt', undefined, { model: undefined });

    // Expect NO --model flag
    const spawnArgs = mockSpawn.mock.calls[0][1];
    expect(spawnArgs).not.toContain('--model');
  });

  test('dispatch should handle complex prompts without shell escaping issues', async () => {
    mockSpawnProcess('success');
    
    const complexPrompt = 'Check `ls -la` and "grep" output';
    await copilotCLI.dispatch(complexPrompt);

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--prompt', complexPrompt]), // Passed verbatim
      expect.any(Object)
    );
  });

  test('dispatch should throw error on non-zero exit code', async () => {
    mockSpawnProcess('', 'Some error occurred', 1);

    await expect(copilotCLI.dispatch('fail')).rejects.toThrow('Copilot CLI failed with exit code 1');
  });

  test('dispatch should throw error on tool approval request', async () => {
    mockSpawnProcess('Allow Copilot to use tool?', '', 1);

    await expect(copilotCLI.dispatch('tool')).rejects.toThrow('TOOL_APPROVAL_REQUIRED');
  });
});
