# Service Mocks - Full Implementation Details

## Overview

All external service mocks for deterministic, isolated functional testing. See detailed sections below for each mock type.

**Locations**: `tests/mocks/infrastructure/` + `tests/mocks/adapters/`

---

## 1. Provider CLI Mocks

### 1.1 Base Provider Mock

**File**: `tests/mocks/infrastructure/providers/base-provider.mock.ts`

**Purpose**: Abstract base class for all provider mocks with common functionality.

```typescript
export interface ProviderResponse {
  success: boolean;
  output: string;
  fileChanges?: FileChange[];
  error?: ProviderError;
  metadata?: Record<string, any>;
}

export interface FileChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  content?: string;
  diff?: string;
}

export interface ProviderError {
  type: 'QUOTA_EXCEEDED' | 'TIMEOUT' | 'NETWORK_ERROR' | 'INVALID_RESPONSE';
  message: string;
  retryable: boolean;
}

export abstract class BaseProviderMock {
  protected callHistory: ProviderCall[] = [];
  protected responseQueue: ProviderResponse[] = [];
  protected defaultBehavior: ProviderBehavior;
  
  constructor(behavior?: ProviderBehavior);
  
  // Configuration
  abstract getProviderName(): Provider;
  setDefaultBehavior(behavior: ProviderBehavior): void;
  queueResponse(response: ProviderResponse): void;
  queueResponses(responses: ProviderResponse[]): void;
  
  // Execution simulation
  async dispatch(
    task: Task,
    context: ProviderContext
  ): Promise<ProviderResponse>;
  
  // Verification
  getCallHistory(): ProviderCall[];
  getCallCount(): number;
  wasCalledWith(task: Task): boolean;
  reset(): void;
  
  // Protected helpers
  protected recordCall(task: Task, response: ProviderResponse): void;
  protected getNextResponse(): ProviderResponse | null;
  protected simulateProcessingDelay(): Promise<void>;
}

export interface ProviderCall {
  timestamp: string;
  taskId: string;
  intent: string;
  response: ProviderResponse;
  duration: number;
}

export interface ProviderContext {
  projectRoot: string;
  state: SupervisorState;
  previousAttempts?: ProviderResponse[];
}
```

### 1.2 Gemini CLI Mock

**File**: `tests/mocks/infrastructure/providers/gemini.mock.ts`

**Purpose**: Mock Gemini CLI interactions.

```typescript
export class GeminiMock extends BaseProviderMock {
  getProviderName(): Provider {
    return Provider.GEMINI;
  }
  
  // Predefined response patterns
  static successResponse(fileChanges: FileChange[]): ProviderResponse {
    return {
      success: true,
      output: 'Task completed successfully',
      fileChanges,
      metadata: {
        model: 'gemini-2.0-flash-exp',
        tokensUsed: 1234
      }
    };
  }
  
  static quotaExceededResponse(): ProviderResponse {
    return {
      success: false,
      output: 'Quota exceeded',
      error: {
        type: 'QUOTA_EXCEEDED',
        message: 'You have exhausted your capacity on this model',
        retryable: false
      }
    };
  }
  
  static timeoutResponse(): ProviderResponse {
    return {
      success: false,
      output: 'Request timed out',
      error: {
        type: 'TIMEOUT',
        message: 'Request exceeded 60 second timeout',
        retryable: true
      }
    };
  }
  
  static ambiguousResponse(): ProviderResponse {
    return {
      success: true,
      output: 'Partial implementation',
      fileChanges: [
        {
          path: 'src/partial.ts',
          type: 'create',
          content: '// TODO: Complete implementation'
        }
      ],
      metadata: {
        confidence: 'LOW',
        incomplete: true
      }
    };
  }
}
```

### 1.3 Copilot CLI Mock

**File**: `tests/mocks/infrastructure/providers/copilot.mock.ts`

```typescript
export class CopilotMock extends BaseProviderMock {
  getProviderName(): Provider {
    return Provider.COPILOT;
  }
  
  static successResponse(fileChanges: FileChange[]): ProviderResponse {
    return {
      success: true,
      output: 'Implementation completed',
      fileChanges,
      metadata: {
        model: 'gpt-4',
        conversationId: 'conv-123'
      }
    };
  }
  
  static networkErrorResponse(): ProviderResponse {
    return {
      success: false,
      output: 'Network error',
      error: {
        type: 'NETWORK_ERROR',
        message: 'Failed to connect to API',
        retryable: true
      }
    };
  }
  
  static invalidResponseResponse(): ProviderResponse {
    return {
      success: false,
      output: 'Invalid JSON response',
      error: {
        type: 'INVALID_RESPONSE',
        message: 'Could not parse provider output',
        retryable: false
      }
    };
  }
}
```

### 1.4 Cursor CLI Mock

**File**: `tests/mocks/infrastructure/providers/cursor.mock.ts`

```typescript
export class CursorMock extends BaseProviderMock {
  getProviderName(): Provider {
    return Provider.CURSOR;
  }
  
  static successResponse(fileChanges: FileChange[]): ProviderResponse {
    return {
      success: true,
      output: 'Changes applied successfully',
      fileChanges,
      metadata: {
        edits: fileChanges.length,
        linesChanged: fileChanges.reduce((sum, fc) => 
          sum + (fc.content?.split('\n').length || 0), 0
        )
      }
    };
  }
}
```

### 1.5 Claude CLI Mock

**File**: `tests/mocks/infrastructure/providers/claude.mock.ts`

```typescript
export class ClaudeMock extends BaseProviderMock {
  getProviderName(): Provider {
    return Provider.CLAUDE;
  }
  
  static successResponse(fileChanges: FileChange[]): ProviderResponse {
    return {
      success: true,
      output: 'Task completed',
      fileChanges,
      metadata: {
        model: 'claude-3-opus',
        reasoning: 'Applied best practices'
      }
    };
  }
}
```

### 1.6 Codex CLI Mock

**File**: `tests/mocks/infrastructure/providers/codex.mock.ts`

```typescript
export class CodexMock extends BaseProviderMock {
  getProviderName(): Provider {
    return Provider.CODEX;
  }
  
  static successResponse(fileChanges: FileChange[]): ProviderResponse {
    return {
      success: true,
      output: 'Code generation complete',
      fileChanges,
      metadata: {
        model: 'code-davinci-002'
      }
    };
  }
}
```

### 1.7 Ollama Mock

**File**: `tests/mocks/infrastructure/providers/ollama.mock.ts`

```typescript
export class OllamaMock extends BaseProviderMock {
  getProviderName(): Provider {
    return Provider.OLLAMA;
  }
  
  static successResponse(fileChanges: FileChange[]): ProviderResponse {
    return {
      success: true,
      output: 'Local model execution complete',
      fileChanges,
      metadata: {
        model: 'codellama:34b',
        local: true
      }
    };
  }
  
  static modelNotFoundResponse(): ProviderResponse {
    return {
      success: false,
      output: 'Model not found',
      error: {
        type: 'INVALID_RESPONSE',
        message: 'Requested model not available locally',
        retryable: false
      }
    };
  }
}
```

---

## 2. File System Mock

### 2.1 Virtual File System

**File**: `tests/mocks/infrastructure/filesystem/fs.mock.ts`

**Purpose**: In-memory file system for testing without disk I/O.

```typescript
export interface VirtualFile {
  path: string;
  content: string;
  metadata: FileMetadata;
}

export interface FileMetadata {
  created: string;
  modified: string;
  size: number;
  permissions: string;
}

export class FileSystemMock {
  private files: Map<string, VirtualFile> = new Map();
  private directories: Set<string> = new Set();
  private operationHistory: FileOperation[] = [];
  
  constructor(initialFiles?: VirtualFile[]);
  
  // File operations
  async readFile(path: string): Promise<string>;
  async writeFile(path: string, content: string): Promise<void>;
  async appendFile(path: string, content: string): Promise<void>;
  async deleteFile(path: string): Promise<void>;
  async exists(path: string): Promise<boolean>;
  async stat(path: string): Promise<FileMetadata>;
  
  // Directory operations
  async mkdir(path: string, recursive?: boolean): Promise<void>;
  async rmdir(path: string): Promise<void>;
  async readdir(path: string): Promise<string[]>;
  
  // Glob operations
  async glob(pattern: string): Promise<string[]>;
  
  // Utility
  reset(): void;
  getOperationHistory(): FileOperation[];
  applyFileChanges(changes: FileChange[]): Promise<void>;
  
  // State inspection
  getAllFiles(): VirtualFile[];
  getFileCount(): number;
  getTotalSize(): number;
}

export interface FileOperation {
  type: 'read' | 'write' | 'delete' | 'mkdir' | 'rmdir';
  path: string;
  timestamp: string;
}
```

### 2.2 Sandbox Manager Mock

**File**: `tests/mocks/infrastructure/filesystem/sandbox-manager.mock.ts`

**Purpose**: Mock sandbox directory operations.

```typescript
export class SandboxManagerMock {
  private fs: FileSystemMock;
  private sandboxRoot: string;
  
  constructor(fs: FileSystemMock, sandboxRoot?: string);
  
  // Sandbox lifecycle
  async createSandbox(projectId: string): Promise<string>;
  async deleteSandbox(projectId: string): Promise<void>;
  async sandboxExists(projectId: string): Promise<boolean>;
  
  // Project operations
  async getProjectPath(projectId: string): Promise<string>;
  async listProjects(): Promise<string[]>;
  
  // File operations within sandbox
  async readProjectFile(projectId: string, filePath: string): Promise<string>;
  async writeProjectFile(
    projectId: string, 
    filePath: string, 
    content: string
  ): Promise<void>;
  
  // Sandbox state
  async getSandboxState(projectId: string): Promise<SandboxState>;
}

export interface SandboxState {
  projectId: string;
  path: string;
  fileCount: number;
  totalSize: number;
  lastModified: string;
}
```

### 2.3 File Fixtures

**File**: `tests/mocks/infrastructure/filesystem/file-fixtures.ts`

**Purpose**: Predefined file contents for common scenarios.

```typescript
export const FileFixtures = {
  // TypeScript files
  typescript: {
    simpleFunction: `
export function validateInput(input: string): boolean {
  if (!input || input.length === 0) {
    return false;
  }
  return true;
}
`,
    
    classDefinition: `
export class UserService {
  constructor(private db: Database) {}
  
  async findUser(id: string): Promise<User | null> {
    return this.db.users.findById(id);
  }
}
`,
    
    testFile: `
import { validateInput } from './validator';

describe('validateInput', () => {
  it('should return false for empty input', () => {
    expect(validateInput('')).toBe(false);
  });
  
  it('should return true for valid input', () => {
    expect(validateInput('hello')).toBe(true);
  });
});
`
  },
  
  // Configuration files
  config: {
    packageJson: `
{
  "name": "test-project",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0"
  }
}
`,
    
    tsconfig: `
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true
  }
}
`
  },
  
  // Documentation
  docs: {
    readme: `
# Test Project

This is a test project for Foundry functional tests.

## Installation

\`\`\`bash
npm install
\`\`\`
`
  },
  
  // Incomplete/ambiguous files
  incomplete: {
    partialImplementation: `
export class Service {
  // TODO: Implement this method
  async process(): Promise<void> {
    throw new Error('Not implemented');
  }
}
`
  }
};
```

---

## 3. Command Executor Mock

### 3.1 Command Executor Implementation

**File**: `tests/mocks/infrastructure/executor/command-executor.mock.ts`

**Purpose**: Mock child_process operations for verification commands.

```typescript
export interface CommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export class CommandExecutorMock {
  private commandOutputs: Map<string, CommandOutput> = new Map();
  private executionHistory: CommandExecution[] = [];
  private defaultOutput: CommandOutput;
  
  constructor();
  
  // Configuration
  setCommandOutput(command: string, output: CommandOutput): void;
  setCommandOutputs(outputs: Map<string, CommandOutput>): void;
  setDefaultOutput(output: CommandOutput): void;
  
  // Execution
  async execute(command: string, cwd?: string): Promise<CommandOutput>;
  async executeMultiple(commands: string[], cwd?: string): Promise<CommandOutput[]>;
  
  // Verification
  getExecutionHistory(): CommandExecution[];
  wasCommandExecuted(command: string): boolean;
  getCommandExecutionCount(command: string): number;
  
  // Utility
  reset(): void;
}

export interface CommandExecution {
  command: string;
  cwd: string;
  timestamp: string;
  output: CommandOutput;
}
```

### 3.2 Verification Commands

**File**: `tests/mocks/infrastructure/executor/verification-commands.ts`

**Purpose**: Predefined outputs for common verification commands.

```typescript
export const VerificationCommands = {
  // Test execution
  jestPass: {
    command: 'npm test',
    output: {
      stdout: 'PASS tests/unit.test.ts\n Test Suites: 1 passed, 1 total',
      stderr: '',
      exitCode: 0,
      duration: 1500
    }
  },
  
  jestFail: {
    command: 'npm test',
    output: {
      stdout: '',
      stderr: 'FAIL tests/unit.test.ts\n Expected true, received false',
      exitCode: 1,
      duration: 1200
    }
  },
  
  // Build commands
  typescriptCompile: {
    command: 'tsc --noEmit',
    output: {
      stdout: '',
      stderr: '',
      exitCode: 0,
      duration: 2000
    }
  },
  
  typescriptError: {
    command: 'tsc --noEmit',
    output: {
      stdout: '',
      stderr: 'error TS2322: Type string is not assignable to type number',
      exitCode: 2,
      duration: 1800
    }
  },
  
  // Linting
  eslintPass: {
    command: 'eslint src/',
    output: {
      stdout: '',
      stderr: '',
      exitCode: 0,
      duration: 800
    }
  },
  
  eslintFail: {
    command: 'eslint src/',
    output: {
      stdout: '',
      stderr: 'src/index.ts:10:5 - error: unused variable',
      exitCode: 1,
      duration: 900
    }
  },
  
  // File checks
  fileExists: {
    command: 'test -f src/index.ts',
    output: {
      stdout: '',
      stderr: '',
      exitCode: 0,
      duration: 50
    }
  },
  
  fileNotExists: {
    command: 'test -f src/missing.ts',
    output: {
      stdout: '',
      stderr: '',
      exitCode: 1,
      duration: 50
    }
  },
  
  // Git operations
  gitStatus: {
    command: 'git status --short',
    output: {
      stdout: ' M src/index.ts\n A src/new.ts',
      stderr: '',
      exitCode: 0,
      duration: 100
    }
  }
};

export type CommandOutputMap = Map<string, CommandOutput>;

export function createCommandMap(
  commands: Array<{ command: string; output: CommandOutput }>
): CommandOutputMap {
  return new Map(commands.map(c => [c.command, c.output]));
}
```

### 3.3 Process Spawner Mock

**File**: `tests/mocks/infrastructure/executor/process-spawner.mock.ts`

**Purpose**: Mock process spawning for background tasks.

```typescript
export class ProcessSpawnerMock {
  private processes: Map<number, MockProcess> = new Map();
  private nextPid: number = 1000;
  
  spawn(command: string, args: string[], options?: SpawnOptions): MockProcess {
    const pid = this.nextPid++;
    const process = new MockProcess(pid, command, args);
    this.processes.set(pid, process);
    return process;
  }
  
  kill(pid: number, signal?: string): boolean {
    const process = this.processes.get(pid);
    if (process) {
      process.kill(signal);
      return true;
    }
    return false;
  }
  
  getAllProcesses(): MockProcess[] {
    return Array.from(this.processes.values());
  }
  
  reset(): void {
    this.processes.clear();
    this.nextPid = 1000;
  }
}

export class MockProcess {
  pid: number;
  command: string;
  args: string[];
  exitCode: number | null = null;
  killed: boolean = false;
  
  constructor(pid: number, command: string, args: string[]) {
    this.pid = pid;
    this.command = command;
    this.args = args;
  }
  
  kill(signal?: string): void {
    this.killed = true;
    this.exitCode = signal === 'SIGKILL' ? -9 : -15;
  }
  
  on(event: string, callback: Function): void {
    // Mock event handling
  }
}
```

---

## 4. Adapter Mocks

### 4.1 CLI Adapter Mock

**File**: `tests/mocks/adapters/cli-adapter.mock.ts`

**Purpose**: Mock the CLIAdapter that dispatches to providers.

```typescript
export class CLIAdapterMock {
  private providerMocks: Map<Provider, BaseProviderMock>;
  private circuitBreakerMock: CircuitBreakerMock;
  private callHistory: AdapterCall[] = [];
  
  constructor(
    providerMocks: Map<Provider, BaseProviderMock>,
    circuitBreakerMock: CircuitBreakerMock
  );
  
  async dispatch(
    task: Task,
    context: ProviderContext
  ): Promise<ProviderResult>;
  
  // Provider selection
  selectProvider(priority: Provider[]): Provider | null;
  
  // Verification
  getCallHistory(): AdapterCall[];
  getProviderUsageCount(provider: Provider): number;
  
  reset(): void;
}

export interface AdapterCall {
  timestamp: string;
  taskId: string;
  providerUsed: Provider;
  result: ProviderResult;
}
```

### 4.2 Circuit Breaker Mock

**File**: `tests/mocks/adapters/circuit-breaker.mock.ts`

**Purpose**: Mock circuit breaker state management.

```typescript
export class CircuitBreakerMock {
  private states: Map<Provider, CircuitState> = new Map();
  
  constructor();
  
  // State management
  async getState(provider: Provider): Promise<CircuitState>;
  async setState(provider: Provider, state: CircuitState): Promise<void>;
  
  // Circuit operations
  async recordSuccess(provider: Provider): Promise<void>;
  async recordFailure(provider: Provider): Promise<void>;
  async isCircuitOpen(provider: Provider): Promise<boolean>;
  async resetCircuit(provider: Provider): Promise<void>;
  
  // Configuration
  setCircuitOpen(provider: Provider): void;
  setCircuitClosed(provider: Provider): void;
  setCircuitHalfOpen(provider: Provider): void;
  
  // Verification
  getCircuitHistory(): CircuitEvent[];
  
  reset(): void;
}

export interface CircuitState {
  state: 'OPEN' | 'CLOSED' | 'HALF_OPEN';
  failures: number;
  lastFailure: string | null;
  openUntil: string | null;
}

export interface CircuitEvent {
  timestamp: string;
  provider: Provider;
  event: 'SUCCESS' | 'FAILURE' | 'OPENED' | 'CLOSED';
}
```

### 4.3 Logger Mock

**File**: `tests/mocks/adapters/logger.mock.ts`

**Purpose**: Mock logging for test isolation.

```typescript
export class LoggerMock {
  private logs: LogEntry[] = [];
  
  log(component: string, message: string, ...args: unknown[]): void {
    this.logs.push({
      level: 'info',
      component,
      message,
      args,
      timestamp: new Date().toISOString()
    });
  }
  
  logVerbose(component: string, message: string, data?: Record<string, unknown>): void {
    this.logs.push({
      level: 'verbose',
      component,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }
  
  logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
    this.logs.push({
      level: 'performance',
      operation,
      duration,
      metadata,
      timestamp: new Date().toISOString()
    });
  }
  
  // Verification
  getLogs(): LogEntry[];
  getLogsByLevel(level: string): LogEntry[];
  getLogsByComponent(component: string): LogEntry[];
  
  reset(): void;
}

export interface LogEntry {
  level: string;
  component?: string;
  operation?: string;
  message?: string;
  args?: unknown[];
  data?: Record<string, unknown>;
  duration?: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
```

---

## 5. Implementation Order

1. BaseProviderMock → individual providers (Gemini, Copilot, Cursor, Claude, Codex, Ollama)
2. FileSystemMock + SandboxManagerMock + FileFixtures
3. CommandExecutorMock + VerificationCommands + ProcessSpawnerMock
4. CircuitBreakerMock, CLIAdapterMock, LoggerMock
5. Unit tests for all mocks
6. Integration with TestHarness

---

**Full specifications**: See sections 1-4 above for complete TypeScript interfaces and class definitions for all mocks.
