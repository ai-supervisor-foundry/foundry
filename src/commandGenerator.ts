// Command Generator - Helper Agent for generating read-only validation commands
// Uses separate agent instance (different model/provider) to generate verification commands

import { CLIAdapter } from './cliAdapter';
import { CommandGenerationResult } from './types';
import { log as logShared, logVerbose } from './logger';
import { appendPromptLog } from './promptLogger';

function log(message: string, ...args: unknown[]): void {
  logShared('CommandGenerator', message, ...args);
}

/**
 * Generate read-only validation commands via Helper Agent
 * Uses a separate agent instance (different model/provider) to analyze agent response
 * and generate shell commands to verify failed criteria
 */
export async function generateValidationCommands(
  agentResponse: string,
  failedCriteria: string[],
  sandboxCwd: string,
  cliAdapter: CLIAdapter,
  helperAgentMode?: string,
  sandboxRoot?: string,
  projectId?: string,
  taskId?: string
): Promise<CommandGenerationResult> {
  log(`Generating validation commands for ${failedCriteria.length} failed criteria`);
  logVerbose('CommandGenerator', 'Starting command generation', {
    failed_criteria_count: failedCriteria.length,
    agent_response_length: agentResponse.length,
    helper_agent_mode: helperAgentMode || 'auto',
    sandbox_cwd: sandboxCwd,
  });

  // Use helper agent mode from env or default to 'auto'
  const agentMode = helperAgentMode || process.env.HELPER_AGENT_MODE || 'auto';

  // Build prompt for Helper Agent
  const prompt = buildCommandGenerationPrompt(agentResponse, failedCriteria, sandboxCwd);

  // Log Helper Agent prompt
  if (sandboxRoot && projectId && taskId) {
    await appendPromptLog(
      {
        task_id: taskId,
        iteration: 0,
        type: 'PROMPT', // Using PROMPT type for Helper Agent prompts
        content: prompt,
        metadata: {
          agent_mode: agentMode,
          working_directory: sandboxCwd,
          prompt_length: prompt.length,
          prompt_type: 'helper_agent_command_generation',
          failed_criteria: failedCriteria,
          failed_criteria_count: failedCriteria.length,
        },
      },
      sandboxRoot,
      projectId
    );
  }

  // Execute Helper Agent (separate instance via cliAdapter with different agentMode)
  const generationStartTime = Date.now();
  log(`Executing Helper Agent with mode: ${agentMode}`);
  const helperResult = await cliAdapter.execute(prompt, sandboxCwd, agentMode);
  const generationDuration = Date.now() - generationStartTime;

  log(`Helper Agent response received in ${generationDuration}ms`);
  logVerbose('CommandGenerator', 'Helper Agent execution completed', {
    generation_duration_ms: generationDuration,
    response_length: helperResult.stdout?.length || 0,
    exit_code: helperResult.exitCode,
  });

  const helperResponse = helperResult.stdout || helperResult.rawOutput || '';

  // Parse Helper Agent response
  const result = parseHelperAgentResponse(helperResponse, failedCriteria);

  // Log Helper Agent response
  if (sandboxRoot && projectId && taskId) {
    await appendPromptLog(
      {
        task_id: taskId,
        iteration: 0,
        type: 'HELPER_AGENT_RESPONSE',
        content: helperResponse,
        metadata: {
          agent_mode: agentMode,
          working_directory: sandboxCwd,
          response_length: helperResponse.length,
          stdout_length: helperResult.stdout?.length || 0,
          stderr_length: helperResult.stderr?.length || 0,
          exit_code: helperResult.exitCode,
          duration_ms: generationDuration,
          prompt_type: 'helper_agent_command_generation',
          helper_agent_is_valid: result.isValid,
          helper_agent_commands_count: result.verificationCommands.length,
          helper_agent_commands: result.verificationCommands,
        },
      },
      sandboxRoot,
      projectId
    );
  }

  log(`Command generation result: isValid=${result.isValid}, commands=${result.verificationCommands.length}`);
  logVerbose('CommandGenerator', 'Command generation completed', {
    is_valid: result.isValid,
    commands_count: result.verificationCommands.length,
    reasoning: result.reasoning,
  });

  return result;
}

/**
 * Build prompt for Helper Agent to generate validation commands
 */
function buildCommandGenerationPrompt(
  agentResponse: string,
  failedCriteria: string[],
  sandboxCwd: string
): string {
  const sections: string[] = [];

  sections.push('## Command Generation Task');
  sections.push('');
  sections.push('You are a Helper Agent tasked with generating read-only shell commands to verify acceptance criteria.');
  sections.push('');
  sections.push('**Context:**');
  sections.push(`- Working Directory: ${sandboxCwd}`);
  sections.push(`- An agent has attempted to implement the following acceptance criteria:`);
  sections.push('');

  // List failed criteria
  sections.push('**Failed Criteria:**');
  failedCriteria.forEach((criterion, index) => {
    sections.push(`${index + 1}. ${criterion}`);
  });
  sections.push('');

  sections.push('**Agent Response:**');
  sections.push('```');
  sections.push(agentResponse.substring(0, 5000)); // Limit to 5000 chars
  if (agentResponse.length > 5000) {
    sections.push('...');
    sections.push(`[TRUNCATED: ${agentResponse.length} total characters]`);
  }
  sections.push('```');
  sections.push('');

  sections.push('**Your Task:**');
  sections.push('Analyze the agent response and determine:');
  sections.push('1. If the criteria are actually satisfied (based on the response), return `isValid: true`');
  sections.push('2. If not, generate read-only shell commands that can verify each failed criterion');
  sections.push('');
  sections.push('**Command Requirements:**');
  sections.push('- Commands must be READ-ONLY only (no file modifications)');
  sections.push('- Allowed commands: `ls`, `find`, `grep`, `cat`, `head`, `tail`, `wc`, `file`, `stat`, `test`, `[`, `readlink`, `pwd`, `basename`, `dirname`');
  sections.push('- Commands should check for file existence, content patterns, or directory structure');
  sections.push('- Commands should be specific to verifying the failed criteria');
  sections.push('- **IMPORTANT**: For grep commands, use flexible patterns (without quotes) or regex patterns that match variations');
  sections.push('- Example: Use `grep -n "Load More"` or `grep -n Load.*More` instead of `grep -n \'"Load More"\'`');
  sections.push('- Use absolute paths or paths relative to the working directory');
  sections.push('');
  sections.push('**Command Examples:**');
  sections.push('- ✅ Good: `grep -n "Load More" App.tsx` (flexible quotes)');
  sections.push('- ✅ Good: `grep -n Load.*More App.tsx` (regex pattern)');
  sections.push('- ✅ Good: `grep -n hasMore App.tsx` (variable name)');
  sections.push('- ❌ Bad: `grep -n \'"Load More"\' App.tsx` (too strict, exact quotes)');
  sections.push('- ❌ Bad: `grep -n "exact string with quotes" file.tsx` (may not match code)');
  sections.push('');
  sections.push('**Command Generation Guidelines:**');
  sections.push('- Prefer regex patterns over exact string matches');
  sections.push('- Use case-insensitive patterns when possible');
  sections.push('- Check for variable names, function names, and UI text separately');
  sections.push('- Generate multiple commands to verify different aspects of a criterion');
  sections.push('');
  sections.push('**Output Format (JSON):**');
  sections.push('```json');
  sections.push('{');
  sections.push('  "isValid": boolean,  // true if criteria are satisfied, false if commands needed');
  sections.push('  "verificationCommands": [  // Array of shell commands (if isValid is false)');
  sections.push('    "command1",');
  sections.push('    "command2"');
  sections.push('  ],');
  sections.push('  "reasoning": "Brief explanation"  // Optional');
  sections.push('}');
  sections.push('```');
  sections.push('');
  sections.push('**Important:**');
  sections.push('- If `isValid` is `true`, `verificationCommands` should be an empty array');
  sections.push('- If `isValid` is `false`, provide specific commands to verify each criterion');
  sections.push('- Commands will be executed in the working directory');
  sections.push('- Only generate commands that are safe and read-only');

  return sections.join('\n');
}

/**
 * Parse Helper Agent response to extract command generation result
 */
function parseHelperAgentResponse(
  response: string,
  failedCriteria: string[]
): CommandGenerationResult {
  log(`Parsing Helper Agent response (${response.length} chars)`);

  // Try to extract JSON from response
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (typeof parsed.isValid !== 'boolean') {
        log(`Warning: Helper Agent response missing 'isValid' boolean, defaulting to false`);
        return {
          isValid: false,
          verificationCommands: [],
          reasoning: 'Failed to parse Helper Agent response: missing isValid field',
        };
      }

      // Validate verificationCommands
      let commands: string[] = [];
      if (parsed.verificationCommands) {
        if (Array.isArray(parsed.verificationCommands)) {
          commands = parsed.verificationCommands.filter((cmd: unknown) => typeof cmd === 'string');
        } else {
          log(`Warning: Helper Agent response 'verificationCommands' is not an array`);
        }
      }

      return {
        isValid: parsed.isValid,
        verificationCommands: commands,
        reasoning: parsed.reasoning || undefined,
      };
    }
  } catch (error) {
    log(`Failed to parse Helper Agent JSON response: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Fallback: Check response text for indicators
  const responseLower = response.toLowerCase();
  if (responseLower.includes('isvalid') && responseLower.includes('true')) {
    log(`Fallback: Detected isValid=true from response text`);
    return {
      isValid: true,
      verificationCommands: [],
      reasoning: 'Parsed from response text (JSON parse failed)',
    };
  }

  // Default: Not valid, no commands (will proceed to interrogation)
  log(`Fallback: Defaulting to isValid=false, no commands`);
  return {
    isValid: false,
    verificationCommands: [],
    reasoning: 'Failed to parse Helper Agent response, defaulting to invalid',
  };
}

