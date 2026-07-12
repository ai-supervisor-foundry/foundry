import { generateValidationCommands } from '../../../src/domain/executors/commandGenerator';
import { CLIAdapter } from '../../../src/infrastructure/adapters/agents/providers/cliAdapter';
import { Provider } from '../../../src/domain/agents/enums/provider';
import { helperAgentConfig } from '../../../src/config/modelConfig';
import { dispatchToOllama } from '../../../src/infrastructure/connectors/agents/providers/ollamaProvider';

// Mock logger
jest.mock('../../../src/infrastructure/adapters/logging/logger');
jest.mock('../../../src/infrastructure/adapters/logging/promptLogger');
jest.mock('../../../src/infrastructure/connectors/os/executors/fileSystem', () => ({
    getFileList: jest.fn().mockResolvedValue([])
}));
jest.mock('../../../src/infrastructure/connectors/agents/providers/ollamaProvider', () => ({
  dispatchToOllama: jest.fn(),
}));

describe('CommandGenerator secondary adapter', () => {
  let mockCliAdapter: jest.Mocked<CLIAdapter>;
  const mockDispatchToOllama = dispatchToOllama as jest.MockedFunction<typeof dispatchToOllama>;
  const successResult = {
    stdout: '{"isValid": true, "verificationCommands": []}',
    stderr: '',
    rawOutput: '{"isValid": true, "verificationCommands": []}',
    exitCode: 0,
    status: 'COMPLETED' as const,
  };

  beforeEach(() => {
    helperAgentConfig.useLocalModel = false;
    mockCliAdapter = {
      execute: jest.fn(),
      getProviderInUse: jest.fn().mockReturnValue(Provider.CURSOR),
    } as any;
    mockDispatchToOllama.mockReset();
    (mockCliAdapter.execute as jest.Mock).mockResolvedValue(successResult);
    mockDispatchToOllama.mockResolvedValue(successResult);
  });

  it('should call execute once with no provider override (secondary adapter owns selection)', async () => {
    await generateValidationCommands(
      'response', ['criteria'], '/tmp', mockCliAdapter
    );

    expect(mockCliAdapter.execute).toHaveBeenCalledTimes(1);
    expect(mockCliAdapter.execute).toHaveBeenCalledWith(
      expect.any(String),
      '/tmp',
      'auto',
      undefined,
      undefined
    );
    expect(mockDispatchToOllama).not.toHaveBeenCalled();
  });

  it('should route to Ollama when useLocalModel is true', async () => {
    helperAgentConfig.useLocalModel = true;

    await generateValidationCommands(
      'response', ['criteria'], '/tmp', mockCliAdapter
    );

    expect(mockDispatchToOllama).toHaveBeenCalledTimes(1);
    expect(mockDispatchToOllama).toHaveBeenCalledWith(
      expect.any(String),
      '/tmp',
      'auto',
      undefined,
      undefined
    );
    expect(mockCliAdapter.execute).not.toHaveBeenCalled();
  });

  it('should propagate failure from adapter without internal retry', async () => {
    (mockCliAdapter.execute as jest.Mock).mockResolvedValue({
      stdout: '',
      exitCode: 1,
      status: 'FAILED'
    });

    const result = await generateValidationCommands(
      'response', ['criteria'], '/tmp', mockCliAdapter
    );

    // Single call — no internal fallback (adapter handles it via circuit breaker)
    expect(mockCliAdapter.execute).toHaveBeenCalledTimes(1);
    // Graceful degradation: falls back to isValid=false with no commands
    expect(result.isValid).toBe(false);
  });
});
