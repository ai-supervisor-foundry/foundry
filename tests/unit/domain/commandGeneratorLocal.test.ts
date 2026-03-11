import { generateValidationCommands } from '../../../src/domain/executors/commandGenerator';
import { CLIAdapter } from '../../../src/infrastructure/adapters/agents/providers/cliAdapter';
import { Provider } from '../../../src/domain/agents/enums/provider';

// Mock logger
jest.mock('../../../src/infrastructure/adapters/logging/logger');
jest.mock('../../../src/infrastructure/adapters/logging/promptLogger');
jest.mock('../../../src/infrastructure/connectors/os/executors/fileSystem', () => ({
    getFileList: jest.fn().mockResolvedValue([])
}));

describe('CommandGenerator secondary adapter', () => {
  let mockCliAdapter: jest.Mocked<CLIAdapter>;

  beforeEach(() => {
    mockCliAdapter = {
      execute: jest.fn(),
      getProviderInUse: jest.fn().mockReturnValue(Provider.CURSOR),
    } as any;
  });

  it('should call execute once with no provider override (secondary adapter owns selection)', async () => {
    (mockCliAdapter.execute as jest.Mock).mockResolvedValue({
      stdout: '{"isValid": true, "verificationCommands": []}',
      exitCode: 0,
      status: 'COMPLETED'
    });

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
