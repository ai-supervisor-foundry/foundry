
import { ASTProvider } from '../../../domain/validation/ASTProvider';
import { Project, SourceFile, SyntaxKind } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logVerbose } from '../../adapters/logging/logger';

function log(message: string, ...args: unknown[]): void {
  logVerbose('TsMorphAdapter', message, { ...args });
}

export class TsMorphAdapter implements ASTProvider {
  private project: Project | null = null;
  private rootPath: string = '';

  async initialize(rootPath: string): Promise<void> {
    this.rootPath = rootPath;
    const tsConfigPath = path.join(rootPath, 'tsconfig.json');
    
    let tsConfigExists = false;
    try {
      await fs.access(tsConfigPath);
      tsConfigExists = true;
    } catch {
      // No tsconfig
    }

    log(`Initializing TsMorphAdapter for ${rootPath}. TsConfig exists: ${tsConfigExists}`);

    if (tsConfigExists) {
      this.project = new Project({
        tsConfigFilePath: tsConfigPath,
        skipAddingFilesFromTsConfig: false,
      });
    } else {
      this.project = new Project({});
      // Add files manually if no tsconfig
      // For now, we will add source files lazily when needed
    }
  }

  private getSourceFile(filePath: string): SourceFile | undefined {
    if (!this.project) {
        log('Project not initialized');
        return undefined;
    }

    // Try to get file if already added
    let sourceFile = this.project.getSourceFile(filePath);
    
    // If not, try to add it
    if (!sourceFile) {
      try {
        const fullPath = path.resolve(this.rootPath, filePath);
        sourceFile = this.project.addSourceFileAtPath(fullPath);
      } catch (e) {
        log(`Failed to add source file ${filePath}: ${e}`);
        return undefined;
      }
    }
    return sourceFile;
  }

  supports(filePath: string): boolean {
    return /\.(ts|tsx|js|jsx)$/.test(filePath);
  }

  async hasFunction(filePath: string, functionName: string): Promise<boolean> {
    const sourceFile = this.getSourceFile(filePath);
    if (!sourceFile) return false;
    
    // Check function declarations
    const func = sourceFile.getFunction(functionName);
    if (func) return true;

    // Check variable declarations (const func = () => ...)
    const variable = sourceFile.getVariableDeclaration(functionName);
    if (variable) {
        // Simple check if it's initialized with a function-like expression
        const initializer = variable.getInitializer();
        if (initializer && (
            initializer.getKind() === SyntaxKind.ArrowFunction || 
            initializer.getKind() === SyntaxKind.FunctionExpression
        )) {
            return true;
        }
    }

    return false;
  }

  async hasClass(filePath: string, className: string, requiredMethods?: string[]): Promise<boolean> {
    const sourceFile = this.getSourceFile(filePath);
    if (!sourceFile) return false;

    const classDecl = sourceFile.getClass(className);
    if (!classDecl) return false;

    if (requiredMethods && requiredMethods.length > 0) {
        for (const method of requiredMethods) {
            if (!classDecl.getMethod(method)) {
                return false;
            }
        }
    }

    return true;
  }

  async hasInterface(filePath: string, interfaceName: string, requiredMembers?: string[]): Promise<boolean> {
    const sourceFile = this.getSourceFile(filePath);
    if (!sourceFile) return false;

    const interfaceDecl = sourceFile.getInterface(interfaceName);
    if (!interfaceDecl) return false;

    if (requiredMembers && requiredMembers.length > 0) {
        for (const member of requiredMembers) {
            // Check properties and methods
            if (!interfaceDecl.getProperty(member) && !interfaceDecl.getMethod(member)) {
                return false;
            }
        }
    }

    return true;
  }

  async hasExport(filePath: string, exportName: string): Promise<boolean> {
    const sourceFile = this.getSourceFile(filePath);
    if (!sourceFile) return false;

    const exports = sourceFile.getExportedDeclarations();
    return exports.has(exportName) || (exportName === 'default' && !!sourceFile.getDefaultExportSymbol());
  }

  async hasImport(filePath: string, importName: string, fromModule?: string): Promise<boolean> {
    const sourceFile = this.getSourceFile(filePath);
    if (!sourceFile) return false;

    const imports = sourceFile.getImportDeclarations();
    
    for (const importDecl of imports) {
        if (fromModule && importDecl.getModuleSpecifierValue() !== fromModule) {
            continue;
        }

        const namedImports = importDecl.getNamedImports();
        for (const named of namedImports) {
            if (named.getName() === importName) return true;
        }

        const defaultImport = importDecl.getDefaultImport();
        if (defaultImport && defaultImport.getText() === importName) return true;
        
        const namespaceImport = importDecl.getNamespaceImport();
        if (namespaceImport && namespaceImport.getText() === importName) return true;
    }

    return false;
  }
  
  async hasDecorator(filePath: string, decoratorName: string, targetName?: string): Promise<boolean> {
    const sourceFile = this.getSourceFile(filePath);
    if (!sourceFile) return false;

    // Helper to check decorators on a node
    const checkDecorators = (node: any) => {
        const decorators = node.getDecorators();
        return decorators.some((d: any) => d.getName() === decoratorName || d.getName() === decoratorName.replace('@', ''));
    };

    if (targetName) {
        // Target specific class or method
        const classDecl = sourceFile.getClass(targetName);
        if (classDecl) {
            if (checkDecorators(classDecl)) return true;
        }
        
        // If targetName is method, we'd need to search all classes? 
        // For now, let's assume targetName is a class or function top-level
        const funcDecl = sourceFile.getFunction(targetName);
        if (funcDecl) {
             if (checkDecorators(funcDecl)) return true;
        }
    } else {
        // Search globally in file
        // This is expensive, iterate all classes/methods?
        for (const classDecl of sourceFile.getClasses()) {
            if (checkDecorators(classDecl)) return true;
            for (const method of classDecl.getMethods()) {
                if (checkDecorators(method)) return true;
            }
        }
        for (const func of sourceFile.getFunctions()) {
            if (checkDecorators(func)) return true;
        }
    }

    return false;
  }
}
