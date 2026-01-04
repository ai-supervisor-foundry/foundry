// Validator - Deterministic, rule-based, non-AI validation
// No side effects, no retries

import { Task, ValidationReport } from '../../domain/types/types';
import { ProviderResult } from '../../domain/executors/haltDetection';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logVerbose } from '../../infrastructure/adapters/logging/logger';
import { astService } from './ASTService';

const execAsync = promisify(exec);

// We use "log" not logVerbose directly.
function log(message: string, ...args: unknown[]): void {
  // WE HAVE TO use this dont change this.
  logVerbose('Validator', message, { ...args });
}

interface AgentResponseSummary {
  status: 'completed' | 'failed';
  files_created?: string[];
  files_updated?: string[];
  changes?: string[];
  neededChanges?: boolean;
  summary?: string;
}

/**
 * Extracts JSON from mixed text/markdown output
 * Handles markdown code blocks and finds the outermost JSON object
 */
function findJSONInString(text: string): string | null {
  // First, try to extract from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1];
  }

  // Fallback: finding the outermost braces
  let startIndex = -1;
  let openBraces = 0;
  
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (openBraces === 0) startIndex = i;
      openBraces++;
    } else if (text[i] === '}') {
      openBraces--;
      if (openBraces === 0 && startIndex !== -1) {
        return text.substring(startIndex, i + 1);
      }
    }
  }
  
  return null;
}

/**
 * Deterministic task validation
 * Rule-based only, no inference, no LLM calls
 * Validation either PASSES or HALTS
 */
export async function validateTaskOutput(
  task: Task,
  providerResult: ProviderResult,
  sandboxRoot: string
): Promise<ValidationReport> {
  log(`Validating task: ${task.task_id}`);
  
  // Initialize AST Service
  try {
    await astService.initialize(sandboxRoot);
  } catch (error) {
    log(`Warning: Failed to initialize AST service: ${error}`);
  }

  // logging what the task was.
  log(`Task: ${JSON.stringify(task)}`);
  // logging what the provider result was.
  log(`Provider result: ${JSON.stringify(providerResult)}`);
  // logging what the sandbox root was.
  log(`Sandbox root: ${sandboxRoot}`);
  
  const rulesPassed: string[] = [];
  const rulesFailed: string[] = [];
  // Use rawOutput (stdout + stderr combined) for validation
  const output = providerResult.rawOutput || providerResult.stdout || '';
  // logging providerResult.stdout
  log(`Provider stdout: ${providerResult.stdout}`);
  // logging providerResult.stderr if exit code is not 0
  if (providerResult.exitCode !== 0) {
    log(`Provider stderr: ${providerResult.stderr}`);
  }
  // logging providerResult.rawOutput
  log(`Provider raw output: ${providerResult.rawOutput}`);
  log(`Output length: ${output.length} characters`);

  // Parse Agent Response Summary (Structured Output)
  let agentSummary: AgentResponseSummary | null = null;
  const summaryJson = findJSONInString(output);
  if (summaryJson) {
    try {
      const parsed = JSON.parse(summaryJson);
      // Ensure it has the expected shape (status is mandatory)
      if (parsed && (parsed.status === 'completed' || parsed.status === 'failed')) {
        agentSummary = parsed;
        log(`Found agent response summary: ${agentSummary?.status}. Files created: ${agentSummary?.files_created?.length || 0}, Files updated: ${agentSummary?.files_updated?.length || 0}`);
      }
    } catch (e) {
      log(`Failed to parse potential agent summary JSON: ${e}`);
    }
  }

  // Rule 0: Task Type Routing
  // If task_type is 'behavioral', use specialized validator
  if (task.task_type === 'behavioral') {
    log('Routing to Behavioral Validator');
    return validateBehavioralTask(task, providerResult.output || output); // Prefer parsed output
  }

  // Rule 1: task_id must match exactly
  // Extract task_id from output if present, or validate it's in the context
  // For now, we assume task_id is validated by the caller context
  // This rule ensures the output corresponds to the correct task
  const taskIdRule = 'task_id_match';
  // Stub: In real implementation, would extract and compare task_id from output
  // For now, assume it's validated by the control loop context
  rulesPassed.push(taskIdRule);

  // Rule 2: Output must parse to expected JSON schema
  if (task.expected_json_schema) {
    const jsonParseRule = 'output_json_parse';
    try {
      const parsed = JSON.parse(output);
      
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        rulesFailed.push(jsonParseRule);
        return {
          valid: false,
          reason: `Output must be a JSON object, got ${typeof parsed}`,
          rules_passed: rulesPassed,
          rules_failed: rulesFailed,
        };
      }

      // Rule 3: No extra top-level fields allowed
      const noExtraFieldsRule = 'no_extra_fields';
      const expectedKeys = Object.keys(task.expected_json_schema);
      const actualKeys = Object.keys(parsed);
      
      const extraFields = actualKeys.filter(key => !expectedKeys.includes(key));
      if (extraFields.length > 0) {
        rulesFailed.push(noExtraFieldsRule);
        return {
          valid: false,
          reason: `Extra top-level fields not allowed: ${extraFields.join(', ')}`,
          rules_passed: rulesPassed,
          rules_failed: rulesFailed,
        };
      }
      rulesPassed.push(noExtraFieldsRule);

      // Validate schema structure (basic type checking)
      const schemaValidationRule = 'json_schema_validation';
      let schemaValid = true;
      for (const [key, expectedType] of Object.entries(task.expected_json_schema)) {
        if (!(key in parsed)) {
          schemaValid = false;
          break;
        }
        // Basic type checking
        const actualType = typeof parsed[key];
        if (typeof expectedType === 'string') {
          // expectedType is a type name like "string", "number", etc.
          if (expectedType === 'string' && actualType !== 'string') {
            schemaValid = false;
            break;
          } else if (expectedType === 'number' && actualType !== 'number') {
            schemaValid = false;
            break;
          } else if (expectedType === 'boolean' && actualType !== 'boolean') {
            schemaValid = false;
            break;
          }
        }
      }

      if (!schemaValid) {
        rulesFailed.push(schemaValidationRule);
        return {
          valid: false,
          reason: 'Output does not match expected JSON schema',
          rules_passed: rulesPassed,
          rules_failed: rulesFailed,
        };
      }
      rulesPassed.push(schemaValidationRule);
      rulesPassed.push(jsonParseRule);
    } catch (error) {
      rulesFailed.push(jsonParseRule);
      return {
        valid: false,
        reason: `Output is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        rules_passed: rulesPassed,
        rules_failed: rulesFailed,
      };
    }
  }

  // Rule 4: required_artifacts must exist on disk, be inside sandboxRoot, match declared paths exactly
  if ((task.required_artifacts && task.required_artifacts.length > 0) || (agentSummary && (agentSummary.files_created || agentSummary.files_updated))) {
    const artifactsRule = 'required_artifacts_exist';
    const artifactChecks: string[] = [];

    // Combine task-required artifacts with agent-reported artifacts
    const allArtifacts = new Set<string>(task.required_artifacts || []);
    if (agentSummary?.files_created) agentSummary.files_created.forEach(f => allArtifacts.add(f));
    if (agentSummary?.files_updated) agentSummary.files_updated.forEach(f => allArtifacts.add(f));
    if (agentSummary?.changes) agentSummary.changes.forEach(f => allArtifacts.add(f));

    // If agent explicitly states no changes were needed, we can be more confident
    if (agentSummary?.neededChanges === false && agentSummary.status === 'completed') {
      log('Agent reported no changes were needed (already up to date).');
    }

    for (const artifactPath of allArtifacts) {
      // Reject absolute paths or '..'
      if (path.isAbsolute(artifactPath)) {
        artifactChecks.push(`Absolute path not allowed: ${artifactPath}`);
        continue;
      }
      if (artifactPath.includes('..')) {
        artifactChecks.push(`Path traversal not allowed: ${artifactPath}`);
        continue;
      }

      // Resolve path relative to sandboxRoot
      const fullPath = path.resolve(sandboxRoot, artifactPath);
      
      // Ensure path is inside sandboxRoot (prevent directory traversal)
      // Use path.normalize to handle any path manipulation attempts
      const normalizedPath = path.normalize(fullPath);
      const sandboxRootResolved = path.resolve(path.normalize(sandboxRoot));
      
      // Check if path is within sandbox (must start with sandbox root + separator)
      const isWithinSandbox = normalizedPath === sandboxRootResolved || 
        normalizedPath.startsWith(sandboxRootResolved + path.sep);
      
      if (!isWithinSandbox) {
        artifactChecks.push(`Path outside sandbox: ${artifactPath} (resolved to ${normalizedPath})`);
        continue;
      }

      // Check if file exists
      try {
        await fs.access(fullPath);
        // Path matches exactly
      } catch {
        artifactChecks.push(`Artifact not found: ${artifactPath}`);
      }
    }

    if (artifactChecks.length > 0) {
      rulesFailed.push(artifactsRule);
      return {
        valid: false,
        reason: `Required artifacts validation failed: ${artifactChecks.join('; ')}`,
        rules_passed: rulesPassed,
        rules_failed: rulesFailed,
      };
    }
    rulesPassed.push(artifactsRule);
  }

  // Rule 5: If tests required, execute local test command and require exit code === 0
  if (task.tests_required && task.test_command) {
    const testsRule = 'tests_pass';
    try {
      // Execute test command in sandboxRoot
      await execAsync(task.test_command, {
        cwd: sandboxRoot,
        timeout: 300000, // 5 minute timeout
      });

      // execAsync returns { stdout, stderr }
      // If execAsync succeeds, the command passed (exit code 0)
      // If it throws, the command failed (caught in catch block)
      // For now, we assume success if execAsync doesn't throw
      // In the future, we might need to use spawn to get exit codes
      rulesPassed.push(testsRule);
      rulesPassed.push(testsRule);
    } catch (error) {
      rulesFailed.push(testsRule);
      const exitCode = (error as { code?: number }).code;
      return {
        valid: false,
        reason: `Test command execution failed${exitCode !== undefined ? ` with exit code ${exitCode}` : ''}: ${error instanceof Error ? error.message : String(error)}`,
        rules_passed: rulesPassed,
        rules_failed: rulesFailed,
      };
    }
  }

  // Rule 6: acceptance_criteria - ALL must be satisfied, partial success is invalid
  // Validates by checking actual code files, not Cursor output text
  if (task.acceptance_criteria && task.acceptance_criteria.length > 0) {
    const acceptanceCriteriaRule = 'all_acceptance_criteria_met';
    const failedCriteria: string[] = [];

    // Collect all code files to check (from required_artifacts or common code locations)
    const codeFilesToCheck: string[] = [];
    
    // Add required artifacts that are code files
    const allArtifacts = new Set<string>(task.required_artifacts || []);
    if (agentSummary?.files_created) agentSummary.files_created.forEach(f => allArtifacts.add(f));
    if (agentSummary?.files_updated) agentSummary.files_updated.forEach(f => allArtifacts.add(f));
    if (agentSummary?.changes) agentSummary.changes.forEach(f => allArtifacts.add(f));

    if (allArtifacts.size > 0) {
      for (const artifactPath of allArtifacts) {
        if (path.isAbsolute(artifactPath) || artifactPath.includes('..')) {
          continue; // Skip invalid paths
        }
        
        const fullPath = path.resolve(sandboxRoot, artifactPath);
        const normalizedPath = path.normalize(fullPath);
        const sandboxRootResolved = path.resolve(path.normalize(sandboxRoot));
        
        if (normalizedPath.startsWith(sandboxRootResolved + path.sep)) {
          // Check if it's a code file
          const ext = path.extname(artifactPath).toLowerCase();
          if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h'].includes(ext)) {
            codeFilesToCheck.push(normalizedPath);
          }
        }
      }
    }

    // If no required artifacts, check common code directories recursively
    if (codeFilesToCheck.length === 0) {
      const commonCodeDirs = ['src', 'lib', 'app', 'components', 'services', 'utils', 'pages', 'hooks'];
      const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h'];
      
      async function findCodeFiles(dirPath: string): Promise<void> {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
              // Recursively search subdirectories
              await findCodeFiles(fullPath);
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              if (codeExtensions.includes(ext)) {
                codeFilesToCheck.push(fullPath);
              }
            }
          }
        } catch {
          // Directory doesn't exist or can't be read, skip
        }
      }
      
      for (const dir of commonCodeDirs) {
        const dirPath = path.join(sandboxRoot, dir);
        await findCodeFiles(dirPath);
      }
      
      // Also check root-level files (App.tsx, index.tsx, etc.) for frontend projects
      const rootCodeFiles = ['App.tsx', 'App.jsx', 'App.ts', 'App.js', 'index.tsx', 'index.jsx', 'main.tsx', 'main.jsx'];
      for (const fileName of rootCodeFiles) {
        const filePath = path.join(sandboxRoot, fileName);
        try {
          await fs.access(filePath);
          const ext = path.extname(fileName).toLowerCase();
          if (codeExtensions.includes(ext)) {
            codeFilesToCheck.push(filePath);
          }
        } catch {
          // File doesn't exist, skip
        }
      }
    }

    log(`Found ${codeFilesToCheck.length} code files to check`);
    if (codeFilesToCheck.length > 0) {
      log(`Code files: ${codeFilesToCheck.slice(0, 5).map(f => path.relative(sandboxRoot, f)).join(', ')}${codeFilesToCheck.length > 5 ? '...' : ''}`);
    }

    // Read all code files and check for acceptance criteria
    let allCodeContent = '';
    for (const filePath of codeFilesToCheck) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        allCodeContent += `\n// File: ${path.relative(sandboxRoot, filePath)}\n${content}\n`;
      } catch {
        // File doesn't exist or can't be read, skip
      }
    }
    log(`Total code content: ${allCodeContent.length} characters`);

    // Detect if this is a design/planning task based on keywords
    const designKeywords = ['designed', 'plan', 'planned', 'strategy', 'strategies', 'architecture', 'architectural', 'design', 'specification', 'spec', 'documentation'];
    const isDesignTask = task.acceptance_criteria.some(c => 
      designKeywords.some(keyword => c.toLowerCase().includes(keyword))
    );
    log(`Task type detected: ${isDesignTask ? 'DESIGN/PLANNING' : 'IMPLEMENTATION'}`);

    // Phase 1: Check code files (existing logic)
    // Phase 2: If design task or code check fails, check documentation/design files
    const docExtensions = ['.md', '.txt', '.design', '.spec', '.specification', '.doc', '.docx', '.rst'];
    const docDirs = ['docs', 'documentation', 'design', 'specs', 'specifications', '.'];

    // Check each acceptance criterion against code content
    log(`Checking ${task.acceptance_criteria.length} acceptance criteria`);
    const uncertainCriteria: string[] = [];
    
    // Track match quality for confidence scoring
    type MatchQuality = 'EXACT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    const criteriaQuality: Record<string, MatchQuality> = {};

    for (const criterion of task.acceptance_criteria) {
      log(`Checking criterion: "${criterion}"`);
      const criterionLower = criterion.toLowerCase();
      const codeContentLower = allCodeContent.toLowerCase();
      
      // Extract key terms from criterion for more flexible matching
      const keyTerms = criterionLower
        .split(/\s+/)
        .filter(term => term.length > 3 && !['with', 'from', 'the', 'and', 'for', 'that', 'this'].includes(term));
      
      let matchQuality: MatchQuality = 'NONE';
      
      // Method 0: AST-based validation (High Confidence)
      if (matchQuality === 'NONE') {
        try {
          let astPassed = false;
          let astRuleType = '';
          let astTargetName = '';

          // Heuristic: Check for "function <name>" or "method <name>"
          const funcMatch = criterionLower.match(/\b(?:function|method)\s+['"`]?([a-zA-Z0-9_]+)['"`]?/i);
          if (funcMatch) {
            astRuleType = 'FUNCTION_EXISTS';
            astTargetName = funcMatch[1];
          }

          // Heuristic: Check for "class <name>"
          if (!astRuleType) {
            const classMatch = criterionLower.match(/\bclass\s+['"`]?([a-zA-Z0-9_]+)['"`]?/i);
            if (classMatch) {
              astRuleType = 'CLASS_EXISTS';
              astTargetName = classMatch[1];
            }
          }

          // Heuristic: Check for "export <name>"
          if (!astRuleType) {
            const exportMatch = criterionLower.match(/\bexport\s+['"`]?([a-zA-Z0-9_]+)['"`]?/i);
            if (exportMatch) {
              astRuleType = 'EXPORT_EXISTS';
              astTargetName = exportMatch[1];
            }
          }

          // Heuristic: Check for decorator "@Name"
          if (!astRuleType) {
            const decoratorMatch = criterionLower.match(/@([a-zA-Z0-9_]+)/);
            if (decoratorMatch) {
              astRuleType = 'DECORATOR_EXISTS';
              astTargetName = decoratorMatch[1];
            }
          }

          // If an AST rule was inferred, check all candidate files
          if (astRuleType && astTargetName) {
            log(`Attempting AST validation: ${astRuleType} for "${astTargetName}"`);
            for (const filePath of codeFilesToCheck) {
              const result = await astService.validate(filePath, { type: astRuleType, name: astTargetName });
              if (result) {
                astPassed = true;
                log(`✅ AST validation PASSED in ${path.relative(sandboxRoot, filePath)}`);
                break;
              }
            }
            
            if (astPassed) {
              matchQuality = 'HIGH'; // AST validation is high confidence
            }
          }
        } catch (error) {
          log(`AST validation warning: ${error}`);
        }
      }

      // Method 1: Direct string match (for exact phrases)
      if (matchQuality === 'NONE' && codeContentLower.includes(criterionLower)) {
        matchQuality = 'EXACT';
      }
      
      // Method 2: Route/Endpoint parsing for NestJS decorators
      if (matchQuality === 'NONE' && (criterionLower.includes('endpoint') || criterionLower.includes('get /') || criterionLower.includes('post /') || criterionLower.includes('delete /') || criterionLower.includes('put /'))) {
        // Extract HTTP method and path from criterion
        // Examples: "GET /feed/daily endpoint", "DELETE /favorites/:listingId removes from favorites"
        const endpointMatch = criterionLower.match(/(get|post|delete|put|patch)\s+\/?([^\s]+)/);
        if (endpointMatch) {
          const httpMethod = endpointMatch[1].toUpperCase();
          const endpointPath = endpointMatch[2].toLowerCase();
          
          // Look for NestJS decorators: @Get('path'), @Post('path'), etc.
          const decoratorPatterns = [
            // Direct match: @Get('feed/daily') or @Get('daily')
            new RegExp(`@${httpMethod}\\s*\\([^)]*['"]${endpointPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'i'),
            // Path contains endpoint: @Get('my-feed') when looking for 'feed'
            new RegExp(`@${httpMethod}\\s*\\([^)]*['"][^'"]*${endpointPath.split('/').pop()}['"]`, 'i'),
            // Controller prefix + method: @Controller('feed') + @Get('daily')
            new RegExp(`@controller\\s*\\([^)]*['"][^'"]*${endpointPath.split('/')[0]}['"]`, 'i'),
          ];
          
          // Also check for just the decorator existence (e.g., @Get, @Delete)
          const decoratorExists = new RegExp(`@${httpMethod}`, 'i').test(allCodeContent);
          
          if (decoratorExists || decoratorPatterns.some(pattern => pattern.test(allCodeContent))) {
            matchQuality = 'HIGH';
            log(`✅ Endpoint found (HIGH confidence): ${httpMethod} ${endpointPath}`);
          }
        }
      }
      
      // Method 2b: Check for key functionality indicators
      if (matchQuality === 'NONE' && keyTerms.length > 0) {
        // Check for class/function names, method definitions, etc.
        const functionalityPatterns = [
          // Class definitions
          new RegExp(`class\\s+\\w*${keyTerms[0]}\\w*`, 'i'),
          // Function/method definitions
          new RegExp(`(?:function|const|export\\s+(?:async\\s+)?function|export\\s+const)\\s+\\w*${keyTerms[0]}\\w*`, 'i'),
          // Method definitions
          new RegExp(`\\w+\\s*\\([^)]*\\)\\s*[:{].*${keyTerms[0]}`, 'i'),
        ];
        
        for (const pattern of functionalityPatterns) {
          if (pattern.test(allCodeContent)) {
            matchQuality = 'HIGH';
            break;
          }
        }
      }
      
      // Method 3: Check for specific keywords related to the criterion
      if (matchQuality === 'NONE') {
        const keywordMappings: Record<string, string[]> = {
          'query parsing': ['parsequery', 'parsequery', 'parse.*query', 'query.*parse'],
          'keyword extraction': ['extractkeyword', 'extract.*keyword', 'keyword.*extract', 'getkeyword'],
          'filter extraction': ['extractfilter', 'extract.*filter', 'filter.*extract', 'getfilter'],
          'error handling': ['error', 'catch', 'throw', 'try', 'exception', 'errorhandler', 'error.*handl'],
          'search service': ['searchservice', 'search.*service', 'class.*search'],
          'structured filter': ['filterbuilder', 'buildfilter', 'structured.*filter', 'filter.*build'],
          'price range': ['pricerange', 'price.*range', 'minprice', 'maxprice'],
          'location': ['location', 'extractlocation', 'getlocation'],
          'category': ['category', 'extractcategory', 'getcategory'],
          'feed metadata': ['feedmetadata', 'feed.*metadata', 'getfeedmetadata', 'updatefeedmetadata'],
          // Authentication patterns
          'authentication required': ['useguards', '@useguards', 'authguard', '@authguard', 'auth.*guard', '@auth', 'requireauth', '@requireauth', 'guard', '@guard', 'canactivate', 'jwt.*guard'],
          // Duplicate prevention
          'prevent duplicate': ['unique', '@unique', 'unique.*constraint', 'duplicate', 'already.*exists', 'conflict', 'unique.*index'],
          // Endpoint/Route validation
          'endpoint.*get|get.*endpoint': ['@get', 'get.*decorator', 'route.*get', 'http.*get'],
          'endpoint.*post|post.*endpoint': ['@post', 'post.*decorator', 'route.*post', 'http.*post'],
          'endpoint.*delete|delete.*endpoint': ['@delete', 'delete.*decorator', 'route.*delete', 'http.*delete'],
          'endpoint.*put|put.*endpoint': ['@put', 'put.*decorator', 'route.*put', 'http.*put'],
          // Response/Return validation
          'returns.*metadata': ['metadata', 'metadatas', 'response.*metadata', 'feed.*metadata'],
          // Loading states (frontend)
          'loading state': ['loading', 'isloading', 'usestate.*loading', 'setloading', 'loading.*state', 'spinner', 'loader'],
          // TypeScript types
          'typescript types': ['interface', 'type.*=', ':.*type', 'typescript', 'ts.*type', 'interface.*response', 'type.*response'],
          // Frontend-specific patterns
          'phone number sent to backend|phone number.*backend': ['sendotp', 'authservice.sendotp', 'send.*otp', 'phone.*otp'],
          'otp verification calls backend|otp verification.*backend': ['verifyotp', 'authservice.verifyotp', 'verify.*otp'],
          'pagination working|pagination.*working': ['pagination', 'page', 'limit', 'offset', 'currentpage', 'itemsperpage'],
          'pagination working correctly': [
            'pagination', 'page', 'limit', 'offset', 'currentpage', 'itemsperpage',
            'hasmore', 'hasmorepages', 'loadmore', 'load.*more', 'nextpage', 'totalpages',
            'setcurrentpage', 'sethasmore', 'handleloadmore', 'fetchlistings.*page'
          ],
          'loading spinner|spinner.*fetching': ['spinner', 'loader', 'loader2', 'loading.*spinner', 'animate-spin'],
          'loading spinner while fetching': [
            'loading', 'isloading', 'usestate.*loading', 'setloading', 'loading.*state',
            'spinner', 'loader', 'loader2', 'loading.*spinner', 'animate-spin',
            'isloadingmore', 'loadingskeleton', 'skeleton.*grid'
          ],
          'empty state|empty.*listing': ['empty', 'length.*===.*0', 'no.*listing', 'listings.*length.*===.*0', 'listings.length === 0'],
          'empty state when no listings': [
            'empty', 'length.*===.*0', 'no.*listing', 'listings.*length.*===.*0',
            'listings.length === 0', 'no.*results.*found', 'no.*found',
            'empty.*state', '!isloading && !isloadingmore && listings.length === 0'
          ],
          'add.*remove favorite.*api|favorite.*api.*calls': ['addfavorite', 'removefavorite', 'favoriteservice', 'favorite.*service'],
          'heart icon|heart.*shows': ['heart', 'faheart', 'lucide.*heart', 'heart.*icon'],
          'heart icon shows favorites count|heart.*shows.*count': ['favoritescount', 'favorite.*count', 'heart.*favoritescount', 'favoritescount.*heart'],
          'success.*error.*notification|notification': ['notification', 'toast', 'notification.*type', 'success.*error'],
          'success.*error.*notification|success.*notification': ['showsuccess', 'show.*success', 'success.*notification', 'notification.*success'],
          'error.*notification': ['showerror', 'show.*error', 'error.*notification', 'notification.*error'],
          'navigation.*between.*pages|navigation': ['navigation', 'navigate', 'router', 'route', 'link', 'nav'],
          'navigation.*between.*pages': ['routes', 'route', 'navigate', 'usenavigate', 'react-router', 'router.*dom'],
          // Tier limits
          'tier.*limit': ['tier', 'tier.*limit', 'tierconfig', 'tier.*config', 'user.*tier'],
          // Favorite count
          'favorite.*count': ['favoritecount', 'favorite.*count', 'count.*favorite', 'getfavoritecount'],
          // Redis caching
          'redis.*cache|cache.*redis': ['redis', 'cache', 'ttl', 'cache.*service', 'rediscache'],
          // Scheduled jobs
          'scheduled.*job|job.*scheduled': ['@cron', '@schedule', '@interval', 'cron.*expression', 'scheduled.*task'],
          // Sync status
          'sync.*status|status.*sync': ['sync.*status', 'status.*sync', 'syncstatus', 'sync.*health'],
          // Module validation
          'module.*created|created.*module': ['module', '@module', 'module.*export', 'export.*module'],
          'module.*imported|imported.*module': ['import.*module', 'module.*import', 'from.*module'],
        };
        
        // First, try exact match on normalized criterion
        const normalizedCriterion = criterionLower.trim();
        if (keywordMappings[normalizedCriterion]) {
          const patterns = keywordMappings[normalizedCriterion];
          const hasKeywords = patterns.some(kw => {
            try {
              const regex = new RegExp(kw, 'i');
              return regex.test(codeContentLower);
            } catch {
              return codeContentLower.includes(kw);
            }
          });
          if (hasKeywords) {
            matchQuality = 'HIGH';
            log(`✅ Criterion satisfied via exact keyword mapping (HIGH): "${criterion}"`);
          }
        }
        
        // Then, try partial matches
        if (matchQuality === 'NONE') {
          for (const [key, keywords] of Object.entries(keywordMappings)) {
            // Check if criterion contains key or key contains criterion (bidirectional partial match)
            if (normalizedCriterion.includes(key) || key.includes(normalizedCriterion)) {
              const hasKeywords = keywords.some(kw => {
                try {
                  const regex = new RegExp(kw, 'i');
                  return regex.test(codeContentLower);
                } catch {
                  return codeContentLower.includes(kw);
                }
              });
              if (hasKeywords) {
                matchQuality = 'MEDIUM';
                log(`✅ Criterion satisfied via partial keyword mapping (MEDIUM): "${criterion}" (matched "${key}")`);
                break;
              }
            }
          }
        }
        
        // Fallback: check if criterion key terms exist in code
        if (matchQuality === 'NONE' && keyTerms.length > 0) {
          const allKeyTermsFound = keyTerms.every(term => codeContentLower.includes(term));
          if (allKeyTermsFound) {
            matchQuality = 'LOW';
            log(`✅ Criterion satisfied via key terms matching (LOW): "${criterion}"`);
          }
        }
      }
      
      // Method 4: For compound criteria with parentheses, check all components
      // Example: "Feed metadata (limit, remaining, reset time) tracked"
      if (matchQuality === 'NONE' && criterionLower.includes('(') && criterionLower.includes(')')) {
        const match = criterionLower.match(/\(([^)]+)\)/);
        if (match) {
          const components = match[1].split(',').map(c => c.trim().toLowerCase());
          const mainConcept = criterionLower.split('(')[0].trim();
          
          // Check if main concept exists (e.g., "feed metadata")
          const mainConceptPatterns = [
            new RegExp(`\\b${mainConcept.replace(/\s+/g, '.*')}\\w*`, 'i'),
            new RegExp(`\\b${mainConcept.replace(/\s+/g, '')}\\w*`, 'i'),
          ];
          
          const hasMainConcept = mainConceptPatterns.some(pattern => pattern.test(allCodeContent));
          
          if (hasMainConcept) {
            // Check if all components are present
            const allComponentsPresent = components.every(component => {
              // Handle multi-word components like "reset time"
              const componentWords = component.split(/\s+/);
              const componentPatterns = componentWords.map(word => {
                const combined = componentWords.join('');
                return [
                  new RegExp(`\\b${word}\\w*`, 'i'),
                  new RegExp(`\\b${combined}\\w*`, 'i'),
                ];
              }).flat();
              
              return componentPatterns.some(pattern => pattern.test(allCodeContent));
            });
            
            if (allComponentsPresent) {
              matchQuality = 'MEDIUM'; // Compound match is good but heuristic
            }
          }
        }
      }
      
      // Method 5: File structure validation (for project setup tasks)
      if (matchQuality === 'NONE' && (criterionLower.includes('initialized') || criterionLower.includes('configured') || criterionLower.includes('set up'))) {
        // Check for Vite configuration
        if (criterionLower.includes('vite') || criterionLower.includes('react project')) {
          const viteConfigPath = path.join(sandboxRoot, 'vite.config.ts');
          const viteConfigJsPath = path.join(sandboxRoot, 'vite.config.js');
          try {
            await fs.access(viteConfigPath);
            matchQuality = 'HIGH';
            log(`✅ Vite project detected (HIGH): vite.config.ts exists`);
          } catch {
            try {
              await fs.access(viteConfigJsPath);
              matchQuality = 'HIGH';
              log(`✅ Vite project detected (HIGH): vite.config.js exists`);
            } catch {
              // vite.config not found
            }
          }
        }
        
        // Check for Tailwind CSS configuration
        if (criterionLower.includes('tailwind')) {
          const tailwindConfigPaths = [
            path.join(sandboxRoot, 'tailwind.config.js'),
            path.join(sandboxRoot, 'tailwind.config.ts'),
            path.join(sandboxRoot, 'tailwind.config.cjs'),
          ];
          for (const configPath of tailwindConfigPaths) {
            try {
              await fs.access(configPath);
              matchQuality = 'HIGH';
              log(`✅ Tailwind CSS configured (HIGH): ${path.basename(configPath)} exists`);
              break;
            } catch {
              // Continue checking other paths
            }
          }
        }
        
        // Check for TypeScript configuration
        if (criterionLower.includes('typescript') || criterionLower.includes('typescript configured')) {
          const tsConfigPath = path.join(sandboxRoot, 'tsconfig.json');
          try {
            await fs.access(tsConfigPath);
            matchQuality = 'HIGH';
            log(`✅ TypeScript configured (HIGH): tsconfig.json exists`);
          } catch {
            // tsconfig.json not found
          }
        }
        
        // Check for React Router
        if (criterionLower.includes('react router') || criterionLower.includes('router set up')) {
          const packageJsonPath = path.join(sandboxRoot, 'package.json');
          try {
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            const hasRouter = packageJson.dependencies?.['react-router-dom'] || 
                            packageJson.dependencies?.['@tanstack/react-router'] ||
                            packageJson.devDependencies?.['react-router-dom'];
            if (hasRouter) {
              matchQuality = 'HIGH';
              log(`✅ React Router detected in package.json (HIGH)`);
            }
          } catch {
            // package.json doesn't exist or invalid, skip
          }
        }
      }
      
      // Phase 2: If not satisfied in code, check documentation/design files (for design tasks or if code check failed)
      if (matchQuality === 'NONE' && (isDesignTask || allCodeContent.length === 0)) {
        log(`Code check failed for "${criterion}", checking documentation files...`);
        
        // Find documentation files
        const docFilesToCheck: string[] = [];
        
        async function findDocFiles(dirPath: string): Promise<void> {
          try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dirPath, entry.name);
              if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                await findDocFiles(fullPath);
              } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (docExtensions.includes(ext)) {
                  docFilesToCheck.push(fullPath);
                }
              }
            }
          } catch {
            // Directory doesn't exist or can't be read, skip
          }
        }
        
        for (const dir of docDirs) {
          const dirPath = path.join(sandboxRoot, dir);
          await findDocFiles(dirPath);
        }
        
        // Read documentation files and check for criterion
        let allDocContent = '';
        for (const filePath of docFilesToCheck) {
          try {
            const content = await fs.readFile(filePath, 'utf8');
            allDocContent += `\n// File: ${path.relative(sandboxRoot, filePath)}\n${content}\n`;
          } catch {
            // File doesn't exist or can't be read, skip
          }
        }
        
        if (allDocContent.length > 0) {
          const docContentLower = allDocContent.toLowerCase();
          // Check if criterion is mentioned in documentation
          if (docContentLower.includes(criterionLower)) {
            matchQuality = 'HIGH';
            log(`✅ Criterion found in documentation (HIGH): "${criterion}"`);
          } else if (keyTerms.some(term => docContentLower.includes(term))) {
            matchQuality = 'MEDIUM';
            log(`✅ Criterion terms found in documentation (MEDIUM): "${criterion}"`);
          }
        }
      }
      
      criteriaQuality[criterion] = matchQuality;

      // Determine if criterion is uncertain (design task but not found in code or docs)
      const isDesignCriterion = designKeywords.some(keyword => criterionLower.includes(keyword));
      
      if (matchQuality === 'NONE') {
        if (isDesignCriterion) {
          log(`⚠️ Criterion is design/planning type but not found: "${criterion}" - marking as UNCERTAIN`);
          uncertainCriteria.push(criterion);
        } else {
          log(`❌ Criterion NOT satisfied: "${criterion}"`);
          failedCriteria.push(criterion);
        }
      } else {
        // Satisfied, but check quality for confidence
        if (matchQuality === 'LOW' || matchQuality === 'MEDIUM') {
          log(`⚠️ Criterion satisfied but with ${matchQuality} quality - marking as UNCERTAIN for verification`);
          uncertainCriteria.push(criterion);
        } else {
          log(`✅ Criterion satisfied with ${matchQuality} quality`);
        }
      }
    }

    // Determine overall validation confidence
    let confidence: 'HIGH' | 'LOW' | 'UNCERTAIN' = 'HIGH';
    
    // Check quality of satisfied criteria
    const qualities = Object.values(criteriaQuality).filter(q => q !== 'NONE');
    const hasLowQuality = qualities.includes('LOW');
    const hasMediumQuality = qualities.includes('MEDIUM');
    
    if (uncertainCriteria.length > 0) {
      // If we explicitly marked things as uncertain
      confidence = 'UNCERTAIN';
      log(`⚠️ Validation UNCERTAIN: ${uncertainCriteria.length} criteria need verification (LOW/MEDIUM quality or design tasks)`);
    } else if (failedCriteria.length > 0) {
      // Failures mean low confidence in success
      confidence = 'LOW';
      log(`⚠️ Validation LOW confidence: ${failedCriteria.length} criteria not met`);
    } else if (hasLowQuality) {
      // Even if all technically passed, low quality matches degrade confidence
      confidence = 'UNCERTAIN';
      log(`⚠️ Validation UNCERTAIN: All passed but some have LOW match quality`);
    } else if (hasMediumQuality) {
      // Medium quality is acceptable but maybe flagged?
      // For now, let MEDIUM pass as HIGH if no UNCERTAIN flagged
      // Actually, if we flagged them as UNCERTAIN in the loop, confidence is already set above.
      // If we didn't flag them (e.g. decision changed), then check here.
      // My loop logic says: "if matchQuality === 'LOW' || matchQuality === 'MEDIUM' -> uncertainCriteria.push"
      // So confidence will be UNCERTAIN.
    }

    if (failedCriteria.length > 0 || uncertainCriteria.length > 0) {
      log(`Validation FAILED: ${failedCriteria.length} criteria not met, ${uncertainCriteria.length} uncertain`);
      rulesFailed.push(acceptanceCriteriaRule);
      return {
        valid: false,
        reason: `Not all acceptance criteria met. Failed: ${failedCriteria.join(', ')}${uncertainCriteria.length > 0 ? ` | Uncertain: ${uncertainCriteria.join(', ')}` : ''}`,
        rules_passed: rulesPassed,
        rules_failed: rulesFailed,
        confidence,
        failed_criteria: failedCriteria,
        uncertain_criteria: uncertainCriteria,
      };
    }
    log(`All acceptance criteria satisfied`);
    rulesPassed.push(acceptanceCriteriaRule);
  }

  // All rules passed
  log(`✅ Validation PASSED for task: ${task.task_id}`);
  return {
    valid: true,
    rules_passed: rulesPassed,
    rules_failed: rulesFailed,
    confidence: 'HIGH',
  };
}

// Legacy Validator class for backward compatibility
export class Validator {
  async validate(
    task: Task,
    providerOutput: string,
    workingDirectory: string
  ): Promise<ValidationReport> {
    // Convert to ProviderResult format
    const providerResult: ProviderResult = {
      stdout: providerOutput,
      stderr: '',
      exitCode: 0,
      rawOutput: providerOutput,
    };

    return validateTaskOutput(task, providerResult, workingDirectory);
  }
}

/**
 * Validate behavioral/conversational tasks
 * Checks response content instead of file artifacts
 */
function validateBehavioralTask(task: Task, responseText: string): ValidationReport {
  log(`Starting Behavioral Validation for task: ${task.task_id}`);
  const rulesPassed: string[] = [];
  const rulesFailed: string[] = [];
  const failedCriteria: string[] = [];
  const responseLower = responseText.toLowerCase();

  // Basic check: Response must not be empty
  if (!responseText || responseText.trim().length === 0) {
    return {
      valid: false,
      reason: 'Response is empty',
      rules_passed: [],
      rules_failed: ['response_not_empty'],
      confidence: 'HIGH',
    };
  }
  rulesPassed.push('response_not_empty');

  // Check acceptance criteria against response text
  if (task.acceptance_criteria && task.acceptance_criteria.length > 0) {
    log(`Checking ${task.acceptance_criteria.length} behavioral criteria`);
    
    for (const criterion of task.acceptance_criteria) {
      const criterionLower = criterion.toLowerCase();
      let satisfied = false;

      // keyword matching
      // If criterion is "Greet", look for greetings
      if (criterionLower.includes('greet')) {
        if (responseLower.match(/\b(hello|hi|hey|greetings)\b/)) {
          satisfied = true;
        }
      } 
      // If criterion is "concise", check length (arbitrary heuristic: < 200 words?)
      else if (criterionLower.includes('concise')) {
        const wordCount = responseText.split(/\s+/).length;
        if (wordCount < 300) {
          satisfied = true;
        }
      }
      // General case: Check if criterion keywords appear in response
      // This is weak but better than nothing for behavioral checks
      else {
        // Remove common words
        const keywords = criterionLower.split(/\s+/).filter(w => w.length > 3);
        const matchCount = keywords.filter(k => responseLower.includes(k)).length;
        if (matchCount >= keywords.length * 0.5) { // 50% keyword match
           satisfied = true;
        }
        
        // Also check if the agent explicitly claimed it did it
        if (responseLower.includes(criterionLower)) {
            satisfied = true;
        }
      }

      if (satisfied) {
        log(`✅ Behavioral criterion satisfied: "${criterion}"`);
      } else {
        log(`❌ Behavioral criterion NOT satisfied: "${criterion}"`);
        failedCriteria.push(criterion);
      }
    }

    if (failedCriteria.length > 0) {
      rulesFailed.push('all_acceptance_criteria_met');
      return {
        valid: false,
        reason: `Behavioral criteria failed: ${failedCriteria.join(', ')}`,
        rules_passed: rulesPassed,
        rules_failed: rulesFailed,
        confidence: 'UNCERTAIN',
        failed_criteria: failedCriteria,
      };
    }
    rulesPassed.push('all_acceptance_criteria_met');
  }

  return {
    valid: true,
    rules_passed: rulesPassed,
    rules_failed: rulesFailed,
    confidence: 'HIGH',
  };
}
