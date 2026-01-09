
import { OllamaProvider } from '../../../../../../src/infrastructure/connectors/agents/providers/ollamaProvider';
import { Ollama } from 'ollama';

// Mock Ollama SDK
jest.mock('ollama');

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  let mockOllama: jest.Mocked<Ollama>;

  beforeEach(() => {
    mockOllama = new Ollama() as jest.Mocked<Ollama>;
    (Ollama as jest.Mock).mockImplementation(() => mockOllama);
    provider = new OllamaProvider('http://localhost:11434', 'phi4-mini');
  });

  it('should execute a prompt and return a successful ProviderResult', async () => {
    const mockResponse = {
      message: { content: '{"isValid": true}' },
      eval_count: 100,
      total_duration: 5000000000 // 5 seconds in nanoseconds
    };
    
    mockOllama.chat.mockResolvedValue(mockResponse as any);

    const result = await provider.execute('test prompt');

    expect(result.status).toBe('COMPLETED');
    expect(result.stdout).toBe('{"isValid": true}');
    expect(result.usage?.tokens).toBe(100);
    expect(result.exitCode).toBe(0);
  });

  it('should return a FAILED status when the Ollama API throws an error', async () => {
    mockOllama.chat.mockRejectedValue(new Error('Connection failed'));

    const result = await provider.execute('test prompt');

    expect(result.status).toBe('FAILED');
    expect(result.stderr).toContain('Connection failed');
    expect(result.exitCode).toBe(1);
  });

  it('should perform a health check successfully', async () => {
    mockOllama.list.mockResolvedValue({ models: [] } as any);
    const isHealthy = await provider.checkHealth();
    expect(isHealthy).toBe(true);
  });

  it('should fail health check if Ollama is unreachable', async () => {
    mockOllama.list.mockRejectedValue(new Error('Unreachable'));
    const isHealthy = await provider.checkHealth();
    expect(isHealthy).toBe(false);
  });
});
