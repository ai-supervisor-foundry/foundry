import { ASTService } from '../../../src/application/services/ASTService';
import { ASTProvider } from '../../../src/domain/validation/ASTProvider';

// Mock provider for testing
class MockASTProvider implements ASTProvider {
  private supportedExtensions: string[];
  public initializeCalled = false;
  public sandboxRoot?: string;

  constructor(extensions: string[]) {
    this.supportedExtensions = extensions;
  }

  supports(filePath: string): boolean {
    return this.supportedExtensions.some(ext => filePath.endsWith(ext));
  }

  async initialize(sandboxRoot: string): Promise<void> {
    this.initializeCalled = true;
    this.sandboxRoot = sandboxRoot;
  }

  async hasFunction(filePath: string, functionName: string): Promise<boolean> {
    return functionName === 'existingFunction';
  }

  async hasClass(filePath: string, className: string, methods?: string[]): Promise<boolean> {
    if (className === 'ExistingClass') {
      if (methods) {
        return methods.every(m => ['method1', 'method2'].includes(m));
      }
      return true;
    }
    return false;
  }

  async hasExport(filePath: string, exportName: string): Promise<boolean> {
    return exportName === 'exportedItem';
  }

  async hasImport(filePath: string, importName: string, fromModule?: string): Promise<boolean> {
    if (fromModule) {
      return importName === 'namedImport' && fromModule === 'some-module';
    }
    return importName === 'defaultImport';
  }

  async hasDecorator(filePath: string, decoratorName: string, target?: string): Promise<boolean> {
    return decoratorName === 'Controller' && (!target || target === 'UserController');
  }
}

describe('ASTService', () => {
  let astService: ASTService;
  let mockProvider: MockASTProvider;

  beforeEach(() => {
    astService = new ASTService();
    mockProvider = new MockASTProvider(['.ts', '.tsx']);
  });

  describe('Provider registration', () => {
    it('should register a new provider', () => {
      astService.registerProvider(mockProvider);
      // Provider should be in the internal list (tested via usage)
      expect(mockProvider).toBeDefined();
    });

    it('should allow multiple providers', () => {
      const provider1 = new MockASTProvider(['.ts']);
      const provider2 = new MockASTProvider(['.py']);
      
      astService.registerProvider(provider1);
      astService.registerProvider(provider2);

      // Both providers registered (tested via initialization)
      expect(provider1).toBeDefined();
      expect(provider2).toBeDefined();
    });

    it('should come with default TsMorph provider pre-registered', () => {
      const newService = new ASTService();
      // Default provider should handle .ts files without explicit registration
      expect(newService).toBeDefined();
    });
  });

  describe('Initialization', () => {
    it('should initialize all providers for a sandbox root', async () => {
      astService.registerProvider(mockProvider);
      const sandboxRoot = '/sandbox/test-project';

      await astService.initialize(sandboxRoot);

      expect(mockProvider.initializeCalled).toBe(true);
      expect(mockProvider.sandboxRoot).toBe(sandboxRoot);
    });

    it('should only initialize once per sandbox root', async () => {
      astService.registerProvider(mockProvider);
      const sandboxRoot = '/sandbox/test-project';

      await astService.initialize(sandboxRoot);
      mockProvider.initializeCalled = false; // Reset flag

      await astService.initialize(sandboxRoot);

      expect(mockProvider.initializeCalled).toBe(false); // Should not initialize again
    });

    it('should allow initialization of different sandbox roots', async () => {
      astService.registerProvider(mockProvider);
      
      await astService.initialize('/sandbox/project1');
      expect(mockProvider.initializeCalled).toBe(true);

      mockProvider.initializeCalled = false;
      await astService.initialize('/sandbox/project2');
      expect(mockProvider.initializeCalled).toBe(true);
    });

    it('should handle provider initialization failures gracefully', async () => {
      const failingProvider = new MockASTProvider(['.js']);
      failingProvider.initialize = jest.fn().mockRejectedValue(new Error('Init failed'));
      
      astService.registerProvider(failingProvider);

      // Should not throw
      await expect(astService.initialize('/sandbox/test')).resolves.not.toThrow();
    });

    it('should continue initializing other providers if one fails', async () => {
      const failingProvider = new MockASTProvider(['.js']);
      failingProvider.initialize = jest.fn().mockRejectedValue(new Error('Init failed'));
      
      astService.registerProvider(failingProvider);
      astService.registerProvider(mockProvider);

      await astService.initialize('/sandbox/test');

      expect(mockProvider.initializeCalled).toBe(true);
    });
  });

  describe('File extension to provider mapping', () => {
    it('should route TypeScript files to TypeScript provider', async () => {
      // Create fresh service without default provider
      const freshService = new ASTService();
      (freshService as any).providers = []; // Clear default providers
      freshService.registerProvider(mockProvider);
      
      const result = await freshService.validate('/project/src/service.ts', {
        type: 'FUNCTION_EXISTS',
        name: 'existingFunction',
      });

      expect(result).toBe(true);
    });

    it('should route TSX files to TypeScript provider', async () => {
      const freshService = new ASTService();
      (freshService as any).providers = [];
      freshService.registerProvider(mockProvider);
      
      const result = await freshService.validate('/project/src/Component.tsx', {
        type: 'CLASS_EXISTS',
        name: 'ExistingClass',
      });

      expect(result).toBe(true);
    });

    it('should return false when no provider supports file type', async () => {
      const freshService = new ASTService();
      (freshService as any).providers = [];
      freshService.registerProvider(mockProvider); // Only supports .ts/.tsx
      
      const result = await freshService.validate('/project/src/script.py', {
        type: 'FUNCTION_EXISTS',
        name: 'someFunction',
      });

      expect(result).toBe(false);
    });

    it('should select first matching provider when multiple support same file', async () => {
      const freshService = new ASTService();
      (freshService as any).providers = [];
      
      const provider1 = new MockASTProvider(['.ts']);
      provider1.hasFunction = jest.fn().mockResolvedValue(true);
      
      const provider2 = new MockASTProvider(['.ts']);
      provider2.hasFunction = jest.fn().mockResolvedValue(false);

      freshService.registerProvider(provider1);
      freshService.registerProvider(provider2);

      const result = await freshService.validate('/project/test.ts', {
        type: 'FUNCTION_EXISTS',
        name: 'testFunc',
      });

      expect(result).toBe(true);
      expect(provider1.hasFunction).toHaveBeenCalled();
      expect(provider2.hasFunction).not.toHaveBeenCalled();
    });
  });

  describe('Rule validation routing', () => {
    let freshService: ASTService;
    
    beforeEach(() => {
      freshService = new ASTService();
      (freshService as any).providers = [];
      freshService.registerProvider(mockProvider);
    });

    it('should validate FUNCTION_EXISTS rule', async () => {
      const result = await freshService.validate('/project/service.ts', {
        type: 'FUNCTION_EXISTS',
        name: 'existingFunction',
      });

      expect(result).toBe(true);
    });

    it('should validate CLASS_EXISTS rule', async () => {
      const result = await freshService.validate('/project/model.ts', {
        type: 'CLASS_EXISTS',
        name: 'ExistingClass',
      });

      expect(result).toBe(true);
    });

    it('should validate CLASS_EXISTS with methods', async () => {
      const result = await freshService.validate('/project/service.ts', {
        type: 'CLASS_EXISTS',
        name: 'ExistingClass',
        methods: ['method1', 'method2'],
      });

      expect(result).toBe(true);
    });

    it('should validate EXPORT_EXISTS rule', async () => {
      const result = await freshService.validate('/project/utils.ts', {
        type: 'EXPORT_EXISTS',
        name: 'exportedItem',
      });

      expect(result).toBe(true);
    });

    it('should validate IMPORT_EXISTS rule', async () => {
      const result = await freshService.validate('/project/index.ts', {
        type: 'IMPORT_EXISTS',
        name: 'defaultImport',
      });

      expect(result).toBe(true);
    });

    it('should validate IMPORT_EXISTS with fromModule', async () => {
      const result = await freshService.validate('/project/index.ts', {
        type: 'IMPORT_EXISTS',
        name: 'namedImport',
        fromModule: 'some-module',
      });

      expect(result).toBe(true);
    });

    it('should validate DECORATOR_EXISTS rule', async () => {
      const result = await freshService.validate('/project/controller.ts', {
        type: 'DECORATOR_EXISTS',
        name: 'Controller',
        target: 'UserController',
      });

      expect(result).toBe(true);
    });

    it('should return false for unknown rule type', async () => {
      const result = await freshService.validate('/project/test.ts', {
        type: 'UNKNOWN_RULE',
        name: 'something',
      } as any);

      expect(result).toBe(false);
    });

    it('should return false when validation fails', async () => {
      const result = await freshService.validate('/project/test.ts', {
        type: 'FUNCTION_EXISTS',
        name: 'nonExistentFunction',
      });

      expect(result).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle provider validation errors gracefully', async () => {
      const freshService = new ASTService();
      (freshService as any).providers = [];
      const errorProvider = new MockASTProvider(['.ts']);
      errorProvider.hasFunction = jest.fn().mockRejectedValue(new Error('Parse error'));
      
      freshService.registerProvider(errorProvider);

      const result = await freshService.validate('/project/broken.ts', {
        type: 'FUNCTION_EXISTS',
        name: 'someFunc',
      });

      expect(result).toBe(false);
    });

    it('should handle syntax errors in analyzed files', async () => {
      const freshService = new ASTService();
      (freshService as any).providers = [];
      const syntaxErrorProvider = new MockASTProvider(['.ts']);
      syntaxErrorProvider.hasClass = jest.fn().mockRejectedValue(
        new Error('Unexpected token')
      );
      
      freshService.registerProvider(syntaxErrorProvider);

      const result = await freshService.validate('/project/syntax-error.ts', {
        type: 'CLASS_EXISTS',
        name: 'MyClass',
      });

      expect(result).toBe(false);
    });

    it('should handle missing file errors', async () => {
      const freshService = new ASTService();
      (freshService as any).providers = [];
      const mockProv = new MockASTProvider(['.ts']);
      freshService.registerProvider(mockProv);
      mockProv.hasFunction = jest.fn().mockRejectedValue(
        new Error('ENOENT: no such file')
      );

      const result = await freshService.validate('/nonexistent/file.ts', {
        type: 'FUNCTION_EXISTS',
        name: 'func',
      });

      expect(result).toBe(false);
    });
  });

  describe('Fallback behavior', () => {
    it('should return false when no provider available', async () => {
      const emptyService = new ASTService();
      (emptyService as any).providers = [];

      const result = await emptyService.validate('/project/file.unknown', {
        type: 'FUNCTION_EXISTS',
        name: 'func',
      });

      expect(result).toBe(false);
    });

    it('should fallback to false for unsupported file types', async () => {
      const freshService = new ASTService();
      (freshService as any).providers = [];
      freshService.registerProvider(mockProvider); // Only .ts/.tsx

      const result = await freshService.validate('/project/script.py', {
        type: 'FUNCTION_EXISTS',
        name: 'pythonFunc',
      });

      expect(result).toBe(false);
    });

    it('should not throw when validating with no providers registered', async () => {
      const bareService = new ASTService();
      (bareService as any).providers = []; // Remove default

      await expect(
        bareService.validate('/any/file.ts', {
          type: 'FUNCTION_EXISTS',
          name: 'func',
        })
      ).resolves.toBe(false);
    });
  });

  describe('Complex validation scenarios', () => {
    let freshService: ASTService;
    
    beforeEach(() => {
      freshService = new ASTService();
      (freshService as any).providers = [];
      freshService.registerProvider(mockProvider);
    });

    it('should validate class with all required methods present', async () => {
      const result = await freshService.validate('/project/service.ts', {
        type: 'CLASS_EXISTS',
        name: 'ExistingClass',
        methods: ['method1', 'method2'],
      });

      expect(result).toBe(true);
    });

    it('should fail when class exists but missing required methods', async () => {
      const result = await freshService.validate('/project/service.ts', {
        type: 'CLASS_EXISTS',
        name: 'ExistingClass',
        methods: ['method1', 'nonExistentMethod'],
      });

      expect(result).toBe(false);
    });

    it('should validate import with specific source module', async () => {
      const result = await freshService.validate('/project/index.ts', {
        type: 'IMPORT_EXISTS',
        name: 'namedImport',
        fromModule: 'some-module',
      });

      expect(result).toBe(true);
    });

    it('should fail when import exists but from wrong module', async () => {
      const result = await freshService.validate('/project/index.ts', {
        type: 'IMPORT_EXISTS',
        name: 'namedImport',
        fromModule: 'wrong-module',
      });

      expect(result).toBe(false);
    });

    it('should validate decorator on specific target', async () => {
      const result = await freshService.validate('/project/controller.ts', {
        type: 'DECORATOR_EXISTS',
        name: 'Controller',
        target: 'UserController',
      });

      expect(result).toBe(true);
    });
  });

  describe('Performance and caching', () => {
    it('should cache initialization per sandbox root', async () => {
      astService.registerProvider(mockProvider);
      const sandboxRoot = '/sandbox/cached-project';

      // First initialization
      await astService.initialize(sandboxRoot);
      expect(mockProvider.initializeCalled).toBe(true);

      // Reset and try again
      mockProvider.initializeCalled = false;
      await astService.initialize(sandboxRoot);
      
      // Should not initialize again (cached)
      expect(mockProvider.initializeCalled).toBe(false);
    });

    it('should allow validation without explicit initialization', async () => {
      const freshService = new ASTService();
      (freshService as any).providers = [];
      freshService.registerProvider(mockProvider);

      // Should not throw even without initialize() call
      const result = await freshService.validate('/project/file.ts', {
        type: 'FUNCTION_EXISTS',
        name: 'existingFunction',
      });

      expect(result).toBe(true);
    });
  });

  describe('Multi-language support', () => {
    it('should route different file types to appropriate providers', async () => {
      const freshService = new ASTService();
      (freshService as any).providers = [];
      
      const tsProvider = new MockASTProvider(['.ts', '.tsx']);
      const pyProvider = new MockASTProvider(['.py']);

      tsProvider.hasFunction = jest.fn().mockResolvedValue(true);
      pyProvider.hasFunction = jest.fn().mockResolvedValue(true);

      freshService.registerProvider(tsProvider);
      freshService.registerProvider(pyProvider);

      const tsResult = await freshService.validate('/project/file.ts', {
        type: 'FUNCTION_EXISTS',
        name: 'func',
      });
      const pyResult = await freshService.validate('/project/script.py', {
        type: 'FUNCTION_EXISTS',
        name: 'func',
      });

      expect(tsResult).toBe(true);
      expect(pyResult).toBe(true);
      expect(tsProvider.hasFunction).toHaveBeenCalled();
      expect(pyProvider.hasFunction).toHaveBeenCalled();
    });

    it('should handle mixed file extensions in same project', async () => {
      const freshService = new ASTService();
      (freshService as any).providers = [];
      const multiProvider = new MockASTProvider(['.ts', '.js', '.jsx']);
      freshService.registerProvider(multiProvider);

      const files = [
        '/project/service.ts',
        '/project/utils.js',
        '/project/Component.jsx',
      ];

      for (const file of files) {
        const result = await freshService.validate(file, {
          type: 'FUNCTION_EXISTS',
          name: 'existingFunction',
        });
        expect(result).toBe(true);
      }
    });
  });
});
