# Strategy: File-Type Agnostic AST Validation (Adapter Pattern)

To implement a file-type agnostic AST validation strategy, we will use an **Interface-Adapter Architecture**. This allows the Supervisor to support TypeScript/JavaScript now via `ts-morph` and easily extend to Python, Go, or other languages later without changing core logic.

## 1. Architecture Overview

We will introduce an **`ASTService`** (Factory) that selects the appropriate **`ASTProvider`** (Adapter) based on the file extension. The core `validator.ts` will communicate only with the generic `ASTProvider` interface.

## 2. Directory Structure

```
src/
├── domain/
│   └── validation/
│       ├── ASTProvider.ts        <-- The Generic Interface
│       └── ValidationRule.ts     <-- AST-specific rule definitions
├── infrastructure/
│   └── adapters/
│       └── ast/
│           ├── TsMorphAdapter.ts <-- TypeScript/JavaScript Implementation
│           └── PythonAdapter.ts  <-- (Future) Python Implementation
└── application/
    └── services/
        └── ASTService.ts         <-- Factory/Registry
```

## 3. The Interface (`src/domain/validation/ASTProvider.ts`)

This interface abstracts AST operations so `validator.ts` doesn't need to know about `ts-morph` or `tree-sitter`.

```typescript
export interface ASTNodeLocation {
  filePath: string;
  line: number;
  column: number;
}

export interface ASTProvider {
  /**
   * Initialize the provider for a specific set of files or directory
   */
  initialize(rootPath: string): Promise<void>;

  /**
   * Check if this provider supports the given file extension
   */
  supports(filePath: string): boolean;

  /**
   * Check if a function exists
   */
  hasFunction(filePath: string, functionName: string): Promise<boolean>;

  /**
   * Check if a class exists, optionally checking for specific methods
   */
  hasClass(filePath: string, className: string, requiredMethods?: string[]): Promise<boolean>;

  /**
   * Check if a variable or type is exported
   */
  hasExport(filePath: string, exportName: string): Promise<boolean>;

  /**
   * Check if a specific import exists
   */
  hasImport(filePath: string, importName: string, fromModule?: string): Promise<boolean>;
  
  /**
   * Check if a specific decorator exists on a class or method
   * (Useful for frameworks like NestJS, Angular, or Python Flask/FastAPI)
   */
  hasDecorator(filePath: string, decoratorName: string, targetName?: string): Promise<boolean>;
}
```

## 4. The Adapter (`src/infrastructure/adapters/ast/TsMorphAdapter.ts`)

This implements the interface using `ts-morph`.

```typescript
import { ASTProvider } from '../../../domain/validation/ASTProvider';
import { Project } from 'ts-morph';

export class TsMorphAdapter implements ASTProvider {
  private project: Project;

  async initialize(rootPath: string): Promise<void> {
    this.project = new Project({
      tsConfigFilePath: `${rootPath}/tsconfig.json`,
      skipAddingFilesFromTsConfig: false,
    });
  }

  supports(filePath: string): boolean {
    return /\.(ts|tsx|js|jsx)$/.test(filePath);
  }

  async hasFunction(filePath: string, functionName: string): Promise<boolean> {
    const sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) return false;
    
    return !!sourceFile.getFunction(functionName) || 
           !!sourceFile.getVariableDeclaration(functionName);
  }

  // ... implementation of other methods
}
```

## 5. The Factory (`src/application/services/ASTService.ts`)

This service manages the lifecycle of providers and routes requests.

```typescript
export class ASTService {
  private providers: ASTProvider[] = [];

  constructor() {
    this.registerProvider(new TsMorphAdapter());
  }

  registerProvider(provider: ASTProvider) {
    this.providers.push(provider);
  }

  async validate(filePath: string, rule: any): Promise<boolean> {
    const provider = this.providers.find(p => p.supports(filePath));
    
    if (!provider) {
      console.warn(`No AST provider for ${filePath}, falling back to Regex`);
      return false; 
    }

    switch (rule.type) {
      case 'FUNCTION_EXISTS':
        return provider.hasFunction(filePath, rule.name);
      case 'CLASS_EXISTS':
        return provider.hasClass(filePath, rule.name, rule.methods);
    }
    return false;
  }
}
```

## 6. Integration Strategy

1.  **Phase 1 (Setup):** Create the Interface and the `TsMorphAdapter`.
2.  **Phase 2 (Registry):** Implement `ASTService` to select the adapter based on file extension.
3.  **Phase 3 (Usage):** In `validator.ts`, inject `ASTService`. When a task comes in:
    *   Identify target files from `required_artifacts`.
    *   If `ASTService` supports the file, run AST validation rules.
    *   If AST validation fails or isn't supported, fall back to the existing Regex logic (with `LOW` confidence).

This strategy ensures `validator.ts` remains clean and language-agnostic while allowing us to plug in `PythonAdapter` or `GoAdapter` in the future without refactoring the core logic.
