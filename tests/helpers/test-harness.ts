import { RedisMock } from '@mocks/infrastructure/redis/redis-mock';
import { GeminiMock } from '@mocks/infrastructure/providers/gemini.mock';
import { CopilotMock } from '@mocks/infrastructure/providers/copilot.mock';
import { FileSystemMock } from '@mocks/infrastructure/filesystem/fs.mock';
import { CommandExecutorMock } from '@mocks/infrastructure/executor/command-executor.mock';
import { StateBuilder } from './state-builders';
import { TaskBuilder } from './task-builders';
import { controlLoop } from '@/application/services/controlLoop';
import { PersistenceLayer } from '@/application/services/persistence';
import { QueueAdapter } from '@/domain/executors/taskQueue';
import { PromptBuilder } from '@/domain/agents/promptBuilder';
import { CLIAdapter } from '@/infrastructure/adapters/agents/providers/cliAdapter';
import { Validator } from '@/application/services/validator';
import { AuditLogger } from '@/infrastructure/adapters/logging/auditLogger';
import { Provider } from '@/domain/agents/enums/provider';
import { CLIAdapterMock } from '@mocks/adapters/cli-adapter.mock';
import * as path from 'path';

import { fsRegistry } from './fs-registry';

export class TestHarness {
  // Mocks
  public redis: RedisMock;
  public gemini: GeminiMock;
  public copilot: CopilotMock;
  public ollama: GeminiMock; // Using GeminiMock as a generic provider mock
  public fs: FileSystemMock;
  public executor: CommandExecutorMock;
  public cliAdapter: CLIAdapterMock;

  // Real services (wired with mocks)
  private persistence: PersistenceLayer;
  private queue: QueueAdapter;
  private promptBuilder: PromptBuilder;
  private validator: Validator;
  private auditLogger: AuditLogger;

  // Config
  private sandboxRoot: string = '/tmp/sandbox';
  private stateKey: string = 'supervisor:state';
  private queueName: string = 'tasks';

  constructor() {
    this.redis = new RedisMock();
    this.gemini = new GeminiMock();
    this.copilot = new CopilotMock();
    this.ollama = new GeminiMock(); // Generic provider
    (this.ollama as any).provider = Provider.OLLAMA;
    
    this.fs = new FileSystemMock();
    this.executor = new CommandExecutorMock();
    this.cliAdapter = new CLIAdapterMock();

    // Wiring
    this.persistence = new PersistenceLayer(this.redis as any, this.stateKey);
    this.queue = new QueueAdapter(this.redis as any, this.queueName);
    this.promptBuilder = new PromptBuilder();
    
    // Inject provider mocks into CLIAdapterMock
    this.cliAdapter.registerProvider(Provider.GEMINI, this.gemini);
    this.cliAdapter.registerProvider(Provider.COPILOT, this.copilot);
    this.cliAdapter.registerProvider(Provider.OLLAMA, this.ollama);

    this.validator = new Validator();
    
    const logPath = path.join(this.sandboxRoot, 'test-project', 'audit.log.jsonl');
    this.auditLogger = new AuditLogger(logPath);
  }

  async setup(): Promise<void> {
    this.redis.reset();
    this.gemini.reset();
    this.copilot.reset();
    this.ollama.reset();
    this.fs.reset();
    this.executor.reset();
    this.cliAdapter.reset();
    
    fsRegistry.setMock(this.fs);
  }

  async teardown(): Promise<void> {
    fsRegistry.reset();
  }

  // --- Execution Helpers ---
  async runControlLoop(maxIterations: number = 10): Promise<void> {
    await controlLoop(
      this.persistence,
      this.queue,
      this.promptBuilder,
      this.cliAdapter,
      this.validator,
      this.auditLogger,
      this.sandboxRoot,
      undefined, // logger
      undefined, // promptLogger
      this.executor, // commandExecutor
      maxIterations
    );
  }

  // --- State Helpers ---
  async loadInitialState(state: any): Promise<void> {
    await this.redis.set(this.stateKey, JSON.stringify(state));
  }

  async getFinalState(): Promise<any> {
    const raw = await this.redis.get(this.stateKey);
    return raw ? JSON.parse(raw) : null;
  }

  async enqueueTasks(tasks: any[]): Promise<void> {
    for (const task of tasks) {
      await this.queue.enqueue(task);
    }
  }
}
