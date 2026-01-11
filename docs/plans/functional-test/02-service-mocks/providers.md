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
