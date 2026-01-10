
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
   * Check if an interface exists, optionally checking for specific properties/methods
   */
  hasInterface(filePath: string, interfaceName: string, requiredMembers?: string[]): Promise<boolean>;

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
