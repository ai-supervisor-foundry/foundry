import { generateValidationCommands } from '../../../src/domain/executors/commandGenerator';
import { CLIAdapter } from '../../../src/infrastructure/adapters/agents/providers/cliAdapter';
import { Provider } from '../../../src/domain/agents/enums/provider';

// Mock config
jest.mock('../../../src/config/modelConfig', () => ({
  helperAgentConfig: {
    useLocalModel: true,
    localModelName: 'test-model',
    ollamaBaseUrl: 'http://localhost:11434',
    fallbackToCloud: true,
    maxRetries: 2,
  },
}));

// Mock logger
jest.mock('../../../src/infrastructure/adapters/logging/logger');
jest.mock('../../../src/infrastructure/adapters/logging/promptLogger');
jest.mock('../../../src/infrastructure/connectors/os/executors/fileSystem', () => ({
    getFileList: jest.fn().mockResolvedValue([])
}));

describe('CommandGenerator Local Model', () => {
  let mockCliAdapter: jest.Mocked<CLIAdapter>;

  beforeEach(() => {
    mockCliAdapter = {
      execute: jest.fn(),
      getProviderInUse: jest.fn().mockReturnValue(Provider.GEMINI),
    } as any;
  });

  it('should use OLLAMA provider when useLocalModel is true', async () => {
    (mockCliAdapter.execute as jest.Mock).mockResolvedValue({
      stdout: '{"isValid": true, "verificationCommands": []}',
      exitCode: 0,
      status: 'COMPLETED'
    });

    await generateValidationCommands(
      'response', ['criteria'], '/tmp', mockCliAdapter
    );

    expect(mockCliAdapter.execute).toHaveBeenCalledWith(
      expect.any(String),
      '/tmp',
      'auto',
      undefined,
      undefined,
      Provider.OLLAMA // Expect OLLAMA override
    );
  });

  it('should fallback to default provider if OLLAMA fails', async () => {
    // First call fails
    (mockCliAdapter.execute as jest.Mock)
      .mockResolvedValueOnce({ status: 'FAILED' })
      .mockResolvedValueOnce({
        stdout: '{"isValid": true, "verificationCommands": []}',
        exitCode: 0,
        status: 'COMPLETED'
      });

    await generateValidationCommands(
      'response', ['criteria'], '/tmp', mockCliAdapter
    );

    // Expect two calls
    expect(mockCliAdapter.execute).toHaveBeenCalledTimes(2);
    // First with OLLAMA
    expect(mockCliAdapter.execute).toHaveBeenNthCalledWith(1,
      expect.any(String), '/tmp', 'auto', undefined, undefined, Provider.OLLAMA
    );
    // Second without override (undefined)
    expect(mockCliAdapter.execute).toHaveBeenNthCalledWith(2,
      expect.any(String), '/tmp', 'auto', undefined, undefined
    ); // undefined is the 6th argument
  });
});
