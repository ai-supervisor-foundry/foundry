
import { ASTProvider } from '../../domain/validation/ASTProvider';
import { TsMorphAdapter } from '../../infrastructure/adapters/ast/TsMorphAdapter';
import { logVerbose } from '../../infrastructure/adapters/logging/logger';

function log(message: string, ...args: unknown[]): void {
  logVerbose('ASTService', message, { ...args });
}

export class ASTService {
  private providers: ASTProvider[] = [];
  private initializedRoots: Set<string> = new Set();

  constructor() {
    // Register default providers
    this.registerProvider(new TsMorphAdapter());
  }

  registerProvider(provider: ASTProvider) {
    this.providers.push(provider);
  }

  /**
   * Initialize all providers for a specific sandbox root
   */
  async initialize(sandboxRoot: string): Promise<void> {
    if (this.initializedRoots.has(sandboxRoot)) return;
    
    log(`Initializing AST providers for root: ${sandboxRoot}`);
    for (const provider of this.providers) {
      try {
        await provider.initialize(sandboxRoot);
      } catch (error) {
        log(`Failed to initialize provider: ${error}`);
      }
    }
    this.initializedRoots.add(sandboxRoot);
  }

  /**
   * Validate a specific rule against a file
   */
  async validate(filePath: string, rule: any): Promise<boolean> {
    const provider = this.providers.find(p => p.supports(filePath));
    
    if (!provider) {
      log(`No AST provider supports file: ${filePath}`);
      return false; 
    }

    try {
        switch (rule.type) {
        case 'FUNCTION_EXISTS':
            return await provider.hasFunction(filePath, rule.name);
        case 'CLASS_EXISTS':
            return await provider.hasClass(filePath, rule.name, rule.methods);
        case 'INTERFACE_EXISTS':
            return await provider.hasInterface(filePath, rule.name, rule.members);
        case 'EXPORT_EXISTS':
            return await provider.hasExport(filePath, rule.name);
        case 'IMPORT_EXISTS':
            return await provider.hasImport(filePath, rule.name, rule.fromModule);
        case 'DECORATOR_EXISTS':
            return await provider.hasDecorator(filePath, rule.name, rule.target);
        default:
            log(`Unknown AST rule type: ${rule.type}`);
            return false;
        }
    } catch (error) {
        log(`AST validation error for ${filePath}: ${error}`);
        return false;
    }
  }
}

export const astService = new ASTService();
