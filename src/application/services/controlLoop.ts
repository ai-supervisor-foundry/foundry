// Supervisor Control Loop Implementation
// Deterministic, no planning, no task invention

import { PersistenceLayer } from './persistence';
import { QueueAdapter } from '../../domain/executors/taskQueue';
import { PromptBuilder, buildPrompt, buildFixPrompt, buildClarificationPrompt, buildGoalCompletionPrompt, parseGoalCompletionResponse, MinimalState } from '../../domain/agents/promptBuilder';
import { CLIAdapter } from '../../infrastructure/adapters/agents/providers/cliAdapter';
import { sessionManager } from '../../domain/agents/sessionManager';
import { Validator, validateTaskOutput } from './validator';
import { AuditLogger, appendAuditLog } from '../../infrastructure/adapters/logging/auditLogger';
import { appendPromptLog } from '../../infrastructure/adapters/logging/promptLogger';
import { SupervisorState, Task, ValidationReport } from '../../domain/types/types';
import { checkHardHalts, HaltReason as HaltDetectionReason, ProviderResult } from '../../domain/executors/haltDetection';
import { interrogateAgent } from '../../domain/executors/interrogator';
import { generateValidationCommands } from '../../domain/executors/commandGenerator';
import { executeVerificationCommands } from '../../infrastructure/connectors/os/executors/commandExecutor';
import { log as logShared, logVerbose, logStateTransition, logPerformance } from '../../infrastructure/adapters/logging/logger';
import { analyticsService } from './analytics';
import * as path from 'path';

const REQUIRED_STATE_FIELDS = [
  'supervisor',
  'supervisor.status',
  'goal',
  'queue',
] as const;

const HALT_REASONS = {
  TASK_LIST_EXHAUSTED_GOAL_INCOMPLETE: 'TASK_LIST_EXHAUSTED_GOAL_INCOMPLETE',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  MISSING_STATE_FIELD: 'MISSING_STATE_FIELD',
  // Halt detection reasons (from haltDetection.ts)
  ASKED_QUESTION: 'ASKED_QUESTION',
  AMBIGUITY: 'AMBIGUITY',
  BLOCKED: 'BLOCKED',
  OUTPUT_FORMAT_INVALID: 'OUTPUT_FORMAT_INVALID',
  CURSOR_EXEC_FAILURE: 'CURSOR_EXEC_FAILURE',
  RESOURCE_EXHAUSTED: 'RESOURCE_EXHAUSTED',
  PROVIDER_CIRCUIT_BROKEN: 'PROVIDER_CIRCUIT_BROKEN'
} as const;

// Resource exhaustion backoff intervals: 1min, 5min, 20min, 1hr, 2hr
const RESOURCE_EXHAUSTED_BACKOFF_MS = [
  1 * 60 * 1000,      // 1 minute
  5 * 60 * 1000,      // 5 minutes
  20 * 60 * 1000,     // 20 minutes
  60 * 60 * 1000,     // 1 hour
  2 * 60 * 60 * 1000, // 2 hours
] as const;

const MAX_RESOURCE_EXHAUSTED_RETRIES = 0;

type HaltReason = typeof HALT_REASONS[keyof typeof HALT_REASONS] | HaltDetectionReason;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message: string, ...args: unknown[]): void {
  logShared('ControlLoop', message, ...args);
}

function validateRequiredFields(state: SupervisorState): void {
  if (!state.supervisor) {
    throw new Error(`Missing required field: supervisor`);
  }
  if (!state.supervisor.status) {
    throw new Error(`Missing required field: supervisor.status`);
  }
  if (!state.goal) {
    throw new Error(`Missing required field: goal`);
  }
  if (!state.queue) {
    throw new Error(`Missing required field: queue`);
  }
}


async function halt(
  state: SupervisorState,
  reason: HaltReason,
  persistence: PersistenceLayer,
  auditLogger: AuditLogger,
  details?: string
): Promise<never> {
  state.supervisor.status = 'HALTED';
  state.supervisor.halt_reason = reason;
  if (details) {
    state.supervisor.halt_details = details;
  }
  
  // Persist before halting
  await persistence.writeState(state);
  
  // Log halt
  await auditLogger.append({
    event: 'HALT',
    reason,
    details,
    timestamp: new Date().toISOString(),
  });

  // Exit process - no automatic resume
  // eslint-disable-next-line no-process-exit
  if (typeof process !== 'undefined' && process.exit) {
    process.exit(1);
  }
  
  // Unreachable, but satisfies TypeScript
  throw new Error('Halt function should never return');
}

export async function controlLoop(
  persistence: PersistenceLayer,
  queue: QueueAdapter,
  promptBuilder: PromptBuilder,
  cliAdapter: CLIAdapter,
  validator: Validator,
  auditLogger: AuditLogger,
  sandboxRoot: string
): Promise<void> {
  let iteration = 0;
  const loopStartTime = Date.now();
  log('Control loop started');
  logVerbose('ControlLoop', 'Initializing control loop', {
    sandboxRoot,
    timestamp: new Date().toISOString(),
  });

  while (true) {
    iteration++;
    const iterationStartTime = Date.now();
    logVerbose('ControlLoop', `Starting iteration ${iteration}`);

    // 1. Load state via persistence layer (single GET)
    const stateLoadStartTime = Date.now();
    logVerbose('ControlLoop', 'Loading state from persistence layer');
    const stateBefore: SupervisorState = await persistence.readState();
    const stateLoadDuration = Date.now() - stateLoadStartTime;
    logPerformance('StateLoad', stateLoadDuration, { iteration });
    
    // Deep copy for state diff tracking
    const stateCopyStartTime = Date.now();
    const state: SupervisorState = JSON.parse(JSON.stringify(stateBefore));
    const stateCopyDuration = Date.now() - stateCopyStartTime;
    logPerformance('StateCopy', stateCopyDuration, { 
      iteration, 
      stateSize: JSON.stringify(state).length 
    });
    
    log(`[Iteration ${iteration}] State loaded, status: ${state.supervisor.status}`);
    logVerbose('ControlLoop', 'State loaded successfully', {
      iteration,
      status: state.supervisor.status,
      iteration_number: state.supervisor.iteration,
      last_task_id: state.supervisor.last_task_id,
      goal_completed: state.goal.completed,
      queue_exhausted: state.queue.exhausted,
      completed_tasks_count: state.completed_tasks?.length || 0,
      blocked_tasks_count: state.blocked_tasks?.length || 0,
    });

    // 2. Validate required state fields exist (fail fast)
    const stateValidationStartTime = Date.now();
    logVerbose('ControlLoop', 'Validating required state fields');
    try {
      validateRequiredFields(state);
      const validationDuration = Date.now() - stateValidationStartTime;
      logPerformance('StateValidation', validationDuration, { iteration });
      logVerbose('ControlLoop', 'State validation passed', { iteration });
    } catch (error) {
      const validationDuration = Date.now() - stateValidationStartTime;
      logPerformance('StateValidation', validationDuration, { iteration, failed: true });
      logVerbose('ControlLoop', 'State validation failed', {
        iteration,
        error: error instanceof Error ? error.message : String(error),
      });
      await halt(
        state,
        HALT_REASONS.MISSING_STATE_FIELD,
        persistence,
        auditLogger,
        error instanceof Error ? error.message : String(error)
      );
    }

    
    // 3. If supervisor.status !== "RUNNING": sleep(1000) and continue
    if (state.supervisor.status !== 'RUNNING') {
      logStateTransition(state.supervisor.status, 'SLEEPING', { iteration, reason: 'Status not RUNNING' });
      log(`[Iteration ${iteration}] Status is ${state.supervisor.status}, sleeping...`);
      logVerbose('ControlLoop', 'Sleeping due to non-RUNNING status', {
        iteration,
        status: state.supervisor.status,
        halt_reason: state.supervisor.halt_reason,
      });
      await sleep(1000);
      continue;
    }
    
    // 3.5. Check for resource_exhausted retry wait period
    if (state.supervisor.resource_exhausted_retry) {
      const retryInfo = state.supervisor.resource_exhausted_retry;
      const now = Date.now();
      const nextRetryAt = new Date(retryInfo.next_retry_at).getTime();
      
      if (now < nextRetryAt) {
        const waitTime = nextRetryAt - now;
        const waitMinutes = Math.ceil(waitTime / (60 * 1000));
        
        // Log only every 60 seconds to reduce log spam
        if (iteration % 60 === 0 || waitTime < 60000) {
          log(`[Iteration ${iteration}] Resource exhausted retry wait: ${waitMinutes} minutes remaining (attempt ${retryInfo.attempt}/${MAX_RESOURCE_EXHAUSTED_RETRIES})`);
        }
        logVerbose('ControlLoop', 'Waiting for resource exhausted retry', {
          iteration,
          attempt: retryInfo.attempt,
          max_retries: MAX_RESOURCE_EXHAUSTED_RETRIES,
          wait_time_ms: waitTime,
          next_retry_at: retryInfo.next_retry_at,
        });
        
        // Sleep for up to 60 seconds, or remaining wait time if less
        const sleepTime = Math.min(waitTime, 60000);
        await sleep(sleepTime);
        continue;
      }
      
      // Wait period expired, resume task execution
      log(`[Iteration ${iteration}] Resource exhausted retry wait expired, resuming task execution (attempt ${retryInfo.attempt}/${MAX_RESOURCE_EXHAUSTED_RETRIES})`);
      logVerbose('ControlLoop', 'Resource exhausted retry wait expired', {
        iteration,
        attempt: retryInfo.attempt,
        last_attempt_at: retryInfo.last_attempt_at,
      });
    }
    
    logStateTransition('CHECKING', 'RUNNING', { iteration });

    // 4. Check for current_task (recovery), then retry_task, then dequeue
    const taskRetrievalStartTime = Date.now();
    logVerbose('ControlLoop', 'Retrieving task', { iteration });
    let task: Task | null = null;
    let taskSource = '';
    
    // Check if there's an interrupted task (current_task)
    if (state.current_task) {
      task = state.current_task;
      taskSource = 'current_task_recovery';
      log(`[Iteration ${iteration}] Recovering interrupted task: ${task.task_id}`);
      logVerbose('ControlLoop', 'Recovered interrupted task from state', {
        iteration,
        task_id: task.task_id,
        intent: task.intent,
      });
    }
    // Check if there's a retry task stored in state
    else if ((state.supervisor as any).retry_task) {
      task = (state.supervisor as any).retry_task;
      taskSource = 'retry_task';
      if (task) {
        const retryCount = (state.supervisor as any)[`retry_count_${task.task_id}`] || 0;
        delete (state.supervisor as any).retry_task; // Clear retry task after retrieving
        log(`[Iteration ${iteration}] Retrieved retry task: ${task.task_id}`);
        logVerbose('ControlLoop', 'Retrieved retry task from state', {
          iteration,
          task_id: task.task_id,
          retry_count: retryCount,
          intent: task.intent,
          status: task.status,
        });
      }
    } else {
      // No retry task, dequeue from queue
      const dequeueStartTime = Date.now();
      task = await queue.dequeue();
      const dequeueDuration = Date.now() - dequeueStartTime;
      logPerformance('TaskDequeue', dequeueDuration, { iteration });
      taskSource = 'queue';
      if (task) {
        log(`[Iteration ${iteration}] Dequeued task from queue: ${task.task_id}`);
        logVerbose('ControlLoop', 'Dequeued task from queue', {
          iteration,
          task_id: task.task_id,
          intent: task.intent,
          tool: task.tool,
          acceptance_criteria_count: task.acceptance_criteria?.length || 0,
          has_retry_policy: !!task.retry_policy,
          working_directory: task.working_directory,
        });
      } else {
        logVerbose('ControlLoop', 'No task available in queue', { iteration });
      }
    }
    const taskRetrievalDuration = Date.now() - taskRetrievalStartTime;
    logPerformance('TaskRetrieval', taskRetrievalDuration, { iteration, source: taskSource, has_task: !!task });

    // 5. If no task:
    if (!task) {
      log(`[Iteration ${iteration}] No task available`);
      logVerbose('ControlLoop', 'No task available, checking queue and goal status', {
        iteration,
        queue_exhausted: state.queue.exhausted,
        goal_completed: state.goal.completed,
      });
      
      // mark queue.exhausted = true
      const previousExhausted = state.queue.exhausted;
      state.queue.exhausted = true;
      if (previousExhausted !== state.queue.exhausted) {
        logStateTransition('QUEUE_ACTIVE', 'QUEUE_EXHAUSTED', { iteration });
      }
      
      // Clear current_task if no task available
      if (state.current_task) {
        state.current_task = undefined;
        await persistence.writeState(state);
      }
      
      // if goal not completed → Ask agent if goal is met
      // disabled by default in .env
      if (process.env.IS_ENABLED_GOAL_COMPLETION_CHECK === 'false') {
        log(`[Iteration ${iteration}] Goal completion check is disabled, skipping...`);
        logVerbose('ControlLoop', 'Goal completion check is disabled, skipping goal completion evaluation', { iteration });
        await sleep(1000);
        continue;
      }
      
      if (!state.goal.completed) {
        log(`[Iteration ${iteration}] Queue exhausted, checking if goal is met...`);
        logVerbose('ControlLoop', 'Asking agent if goal is completed', {
          iteration,
          goal_description: state.goal.description,
          completed_tasks_count: state.completed_tasks?.length || 0,
          blocked_tasks_count: state.blocked_tasks?.length || 0,
        });
        
        // Build goal completion check prompt
        const goalCheckPrompt = buildGoalCompletionPrompt(state, sandboxRoot);
        const projectId = state.goal.project_id || 'default';
        const sandboxCwd = path.join(sandboxRoot, projectId);
        
        // Log goal check prompt
        await appendPromptLog(
          {
            task_id: 'goal-completion-check',
            iteration,
            type: 'GOAL_COMPLETION_CHECK',
            content: goalCheckPrompt,
            metadata: {
              agent_mode: 'auto',
              provider: cliAdapter.getProviderInUse(),
              working_directory: sandboxCwd,
              prompt_length: goalCheckPrompt.length,
            },
          },
          sandboxRoot,
          projectId
        );
        
        // Ask agent if goal is met
        log(`[Iteration ${iteration}] Asking agent if goal is completed...`);
        const goalSessionId = state.active_sessions?.['default']?.session_id || state.active_sessions?.[projectId]?.session_id;
        const goalCheckResult = await cliAdapter.execute(goalCheckPrompt, sandboxCwd, 'auto', goalSessionId);
        const goalCheckResponse = goalCheckResult.stdout || goalCheckResult.rawOutput || '';
        
        // Log goal check response
        await appendPromptLog(
          {
            task_id: 'goal-completion-check',
            iteration,
            type: 'GOAL_COMPLETION_RESPONSE',
            content: goalCheckResponse,
            metadata: {
              agent_mode: 'auto',
              provider: cliAdapter.getProviderInUse(),
              working_directory: sandboxCwd,
              response_length: goalCheckResponse.length,
            },
          },
          sandboxRoot,
          projectId
        );
        
        // Parse agent response to determine if goal is completed
        const goalCompleted = parseGoalCompletionResponse(goalCheckResponse);
        
        if (goalCompleted) {
          log(`[Iteration ${iteration}] Agent confirmed goal is completed`);
          state.goal.completed = true;
          await persistence.writeState(state);
          // Continue to goal completed handling below
        } else {
          log(`[Iteration ${iteration}] Agent confirmed goal is NOT completed - halting`);
          logVerbose('ControlLoop', 'Halting due to exhausted queue and incomplete goal', {
            iteration,
            goal_description: state.goal.description,
            completed_tasks_count: state.completed_tasks?.length || 0,
            blocked_tasks_count: state.blocked_tasks?.length || 0,
            agent_response: goalCheckResponse.substring(0, 200),
          });
          logStateTransition(state.supervisor.status, 'HALTED', {
            iteration,
            reason: HALT_REASONS.TASK_LIST_EXHAUSTED_GOAL_INCOMPLETE,
          });
          await halt(
            state,
            HALT_REASONS.TASK_LIST_EXHAUSTED_GOAL_INCOMPLETE,
            persistence,
            auditLogger,
            `Task queue exhausted and agent confirmed goal is incomplete: ${goalCheckResponse.substring(0, 200)}`
          );
        }
      }
      
      // else mark supervisor.status = COMPLETED, persist state, exit loop
      log(`[Iteration ${iteration}] Queue exhausted, goal completed - exiting`);
      logVerbose('ControlLoop', 'Goal completed, exiting control loop', {
        iteration,
        total_iterations: iteration,
        completed_tasks_count: state.completed_tasks?.length || 0,
        total_duration_ms: Date.now() - loopStartTime,
      });
      logStateTransition(state.supervisor.status, 'COMPLETED', { iteration });
      state.supervisor.status = 'COMPLETED';
      
      const finalPersistStartTime = Date.now();
      await persistence.writeState(state);
      const finalPersistDuration = Date.now() - finalPersistStartTime;
      logPerformance('FinalStatePersist', finalPersistDuration, { iteration });
      
      await auditLogger.append({
        event: 'COMPLETED',
        timestamp: new Date().toISOString(),
      });
      
      const totalLoopDuration = Date.now() - loopStartTime;
      logPerformance('ControlLoop', totalLoopDuration, {
        total_iterations: iteration,
        final_status: 'COMPLETED',
      });
      
      return; // Exit loop
    }

    // Initialize analytics for the task
    analyticsService.initializeTask(task.task_id);
    analyticsService.recordIteration(task.task_id);

    // Set current_task in state and persist
    // This allows UI to see what's running
    state.current_task = task;
    const currentTaskPersistStartTime = Date.now();
    await persistence.writeState(state);
    const currentTaskPersistDuration = Date.now() - currentTaskPersistStartTime;
    logPerformance('CurrentTaskStatePersist', currentTaskPersistDuration, { iteration, task_id: task.task_id });

    // 6. Determine working directory (task override or default from project_id)
    const cwdDeterminationStartTime = Date.now();
    logVerbose('ControlLoop', 'Determining working directory', { iteration, task_id: task.task_id });
    const sandboxCwd = task.working_directory
      ? path.join(sandboxRoot, task.working_directory)
      : `${sandboxRoot}/${state.goal.project_id || 'default'}`;
    const cwdDeterminationDuration = Date.now() - cwdDeterminationStartTime;
    logPerformance('CwdDetermination', cwdDeterminationDuration, { iteration, task_id: task.task_id });
    log(`[Iteration ${iteration}] Task ${task.task_id}: Working directory: ${sandboxCwd}`);
    log(`[Iteration ${iteration}] Task ${task.task_id}: Intent: ${task.intent}`);
    logVerbose('ControlLoop', 'Working directory determined', {
      iteration,
      task_id: task.task_id,
      working_directory: sandboxCwd,
      has_task_override: !!task.working_directory,
      project_id: state.goal.project_id || 'default',
    });

    // 7. Build prompt via promptBuilder using minimal snapshot
    const promptBuildStartTime = Date.now();
    logVerbose('ControlLoop', 'Building prompt', {
      iteration,
      task_id: task.task_id,
      intent: task.intent,
      acceptance_criteria_count: task.acceptance_criteria?.length || 0,
    });
    
    // NEW: Use buildMinimalState for Smart Context Injection
    const minimalState = promptBuilder.buildMinimalSnapshot(state, task, sandboxCwd);
    
    logVerbose('ControlLoop', 'Minimal state snapshot created', {
      iteration,
      task_id: task.task_id,
      project_id: minimalState.project.id,
      goal_included: !!minimalState.goal,
      queue_included: !!minimalState.queue,
      completed_tasks_included: !!minimalState.completed_tasks,
      blocked_tasks_included: !!minimalState.blocked_tasks,
    });
    const prompt = buildPrompt(task, minimalState);
    const promptBuildDuration = Date.now() - promptBuildStartTime;
    logPerformance('PromptBuild', promptBuildDuration, {
      iteration,
      task_id: task.task_id,
      prompt_length: prompt.length,
    });
    log(`[Iteration ${iteration}] Task ${task.task_id}: Prompt built (${prompt.length} chars)`);
    logVerbose('ControlLoop', 'Prompt built successfully', {
      iteration,
      task_id: task.task_id,
      prompt_length: prompt.length,
      prompt_preview: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
    });

    // 8. Dispatch to CLI / Agent with enforced sandbox cwd
    const agentMode = task.agent_mode || 'auto';
    const projectId = state.goal.project_id || 'default';
    
    // Session Resolution & Smart Recovery
    let resolvedSessionId = await sessionManager.resolveSession(
      task.tool,
      task.meta?.feature_id,
      task.meta?.session_id,
      state
    );
    
    // Generate stable feature ID from task characteristics
    const featureId = task.meta?.feature_id 
      || (task.task_id ? `task:${task.task_id.split('_')[0]}` : undefined)
      || (state.goal.project_id ? `project:${state.goal.project_id}` : undefined)
      || 'default';
    
    log(`[Iteration ${iteration}] Task ${task.task_id}: Using feature ID: ${featureId}`);

    // Policy Enforcement: Context & Error Limits
    if (resolvedSessionId && state.active_sessions?.[featureId]) {
      const session = state.active_sessions[featureId];
      
      // Provider-specific context limits
      const CONTEXT_LIMITS: Record<string, number> = {
        'gemini': 350_000,      // Gemini 2.0 Pro: 2M context (leave 500K buffer)
        'gemini-stub': 350_000,
        'copilot': 350_000,       // Conservative estimate
        'cursor': 250_000,        // Claude-based
        'codex': 8_000,           // OpenAI Codex
        'claude': 250_000,        // Claude 3
      };
      
      const ERROR_LIMIT = 5; // Increased from 3
      const contextLimit = CONTEXT_LIMITS[task.tool] || 100_000; // Default conservative

      if (session.total_tokens && session.total_tokens > contextLimit) {
        log(`[Iteration ${iteration}] Task ${task.task_id}: Session context limit exceeded (${session.total_tokens} > ${contextLimit}). Starting new session.`);
        resolvedSessionId = undefined;
        // Optionally clear from state now, but saving back later handles it
      } else if (session.error_count >= ERROR_LIMIT) {
        log(`[Iteration ${iteration}] Task ${task.task_id}: Session error limit exceeded (${session.error_count} >= ${ERROR_LIMIT}). Starting new session.`);
        resolvedSessionId = undefined;
      }
    }

    // Log full prompt to prompts.log.jsonl
    await appendPromptLog(
      {
        task_id: task.task_id,
        iteration,
        type: 'PROMPT',
        content: prompt,
        metadata: {
          agent_mode: agentMode,
          provider: cliAdapter.getProviderInUse(),
          working_directory: sandboxCwd,
          prompt_length: prompt.length,
          intent: task.intent,
          session_id: resolvedSessionId,
        },
      },
      sandboxRoot,
      projectId
    );
    log(`[Iteration ${iteration}] Task ${task.task_id}: Executing CLI / Agent with agent mode: ${agentMode}${resolvedSessionId ? ` (Session: ${resolvedSessionId})` : ''}...`);
    logVerbose('ControlLoop', 'Dispatching to CLI / Agent', {
      iteration,
      task_id: task.task_id,
      working_directory: sandboxCwd,
      prompt_length: prompt.length,
      agent_mode: agentMode,
      session_id: resolvedSessionId,
      feature_id: featureId,
    });
    const providerStartTime = Date.now();
    const providerResult = await cliAdapter.execute(prompt, sandboxCwd, agentMode, resolvedSessionId, featureId);
    const providerDuration = Date.now() - providerStartTime;
    analyticsService.recordExecution(task.task_id, prompt.length, (providerResult.stdout || providerResult.rawOutput || '').length, providerDuration);

    // Save sessionId and usage back to state if returned
    if (providerResult.sessionId) {
      if (!state.active_sessions) state.active_sessions = {};
      
      const currentSession = state.active_sessions[featureId];
      const newTokens = providerResult.usage?.tokens || 0;
      const accumulatedTokens = (resolvedSessionId === providerResult.sessionId && currentSession) 
        ? (currentSession.total_tokens || 0) + newTokens 
        : newTokens;

      state.active_sessions[featureId] = {
        session_id: providerResult.sessionId,
        provider: task.tool,
        last_used: new Date().toISOString(),
        error_count: currentSession && resolvedSessionId === providerResult.sessionId ? currentSession.error_count : 0,
        total_tokens: accumulatedTokens,
        feature_id: featureId,
        task_id: task.task_id
      };
      log(`[Iteration ${iteration}] Task ${task.task_id}: Session ${providerResult.sessionId} updated in state (Tokens: ${accumulatedTokens}, Errors: ${state.active_sessions[featureId].error_count})`);
    }
    log(`[Iteration ${iteration}] Task ${task.task_id}: CLI / Agent completed in ${providerDuration}ms, exit code: ${providerResult.exitCode}`);
    logPerformance('CLIAdapterExecution', providerDuration, {
      iteration,
      task_id: task.task_id,
      exit_code: providerResult.exitCode,
      stdout_length: providerResult.stdout?.length || 0,
      stderr_length: providerResult.stderr?.length || 0,
      raw_output_length: providerResult.rawOutput?.length || 0,
    });
    logVerbose('ControlLoop', 'CLI / Agent execution completed', {
      iteration,
      task_id: task.task_id,
      exit_code: providerResult.exitCode,
      stdout_length: providerResult.stdout?.length || 0,
      stderr_length: providerResult.stderr?.length || 0,
      raw_output_length: providerResult.rawOutput?.length || 0,
      status: providerResult.status,
      stdout_preview: providerResult.stdout?.substring(0, 500) || '',
      stderr_preview: providerResult.stderr?.substring(0, 500) || '',
    });

    // Log full response to prompts.log.jsonl
    const responseContent = providerResult.stdout || providerResult.rawOutput || '';
    await appendPromptLog(
      {
        task_id: task.task_id,
        iteration,
        type: 'RESPONSE',
        content: responseContent,
        metadata: {
          agent_mode: agentMode,
          provider: cliAdapter.getProviderInUse(),
          working_directory: sandboxCwd,
          response_length: responseContent.length,
          stdout_length: providerResult.stdout?.length || 0,
          stderr_length: providerResult.stderr?.length || 0,
          exit_code: providerResult.exitCode,
          duration_ms: providerDuration,
        },
      },
      sandboxRoot,
      projectId
    );

    // Track final prompt and response for audit log
    let finalPrompt = prompt;
    let finalResponse = responseContent;

    // 9. Apply hard halt rules - but allow retry for AMBIGUITY and ASKED_QUESTION
    const haltDetectionStartTime = Date.now();
    logVerbose('ControlLoop', 'Checking for hard halt conditions', {
      iteration,
      task_id: task.task_id,
      exit_code: providerResult.exitCode,
    });
    
    // Determine required keys from task (if JSON output expected)
    const requiredKeys: string[] = []; // Stub: would extract from task.instructions if JSON expected
    logVerbose('ControlLoop', 'Required keys for halt detection', {
      iteration,
      task_id: task.task_id,
      required_keys: requiredKeys,
      has_expected_json_schema: !!task.expected_json_schema,
    });
    
    // Add requiredKeys to providerResult for halt detection
    const providerResultWithKeys: ProviderResult = {
      ...providerResult,
      requiredKeys,
    };
    
    let haltReason = checkHardHalts(providerResultWithKeys);
    const haltDetectionDuration = Date.now() - haltDetectionStartTime;
    logPerformance('HaltDetection', haltDetectionDuration, {
      iteration,
      task_id: task.task_id,
      halt_reason: haltReason || 'none',
    });
    
    if (haltReason) {
      log(`[Iteration ${iteration}] Task ${task.task_id}: Halt detected: ${haltReason}`);
      logVerbose('ControlLoop', 'Halt condition detected', {
        iteration,
        task_id: task.task_id,
        halt_reason: haltReason,
        exit_code: providerResult.exitCode,
        output_length: providerResult.rawOutput?.length || 0,
      });
    } else {
      logVerbose('ControlLoop', 'No halt conditions detected', {
        iteration,
        task_id: task.task_id,
      });
    }
    
    // Handle RESOURCE_EXHAUSTED with backoff retry
    if (haltReason === 'RESOURCE_EXHAUSTED') {
      const currentRetry = state.supervisor.resource_exhausted_retry?.attempt || 0;
      const nextAttempt = currentRetry + 1;
      
      if (nextAttempt > MAX_RESOURCE_EXHAUSTED_RETRIES) {
        // Max retries exceeded, halt permanently
        log(`[Iteration ${iteration}] Task ${task.task_id}: Resource exhausted - max retries (${MAX_RESOURCE_EXHAUSTED_RETRIES}) exceeded, halting`);
        logVerbose('ControlLoop', 'Resource exhausted max retries exceeded', {
          iteration,
          task_id: task.task_id,
          max_retries: MAX_RESOURCE_EXHAUSTED_RETRIES,
        });
        logStateTransition(state.supervisor.status, 'HALTED', {
          iteration,
          task_id: task.task_id,
          reason: 'RESOURCE_EXHAUSTED',
        });
        await halt(
          state,
          'RESOURCE_EXHAUSTED',
          persistence,
          auditLogger,
          `Resource exhausted: max retries (${MAX_RESOURCE_EXHAUSTED_RETRIES}) exceeded`
        );
      }
      
      // Calculate backoff delay
      const backoffMs = RESOURCE_EXHAUSTED_BACKOFF_MS[nextAttempt - 1];
      const now = Date.now();
      const nextRetryAt = new Date(now + backoffMs).toISOString();
      const backoffMinutes = Math.ceil(backoffMs / (60 * 1000));
      
      // Update retry tracking in state
      state.supervisor.resource_exhausted_retry = {
        attempt: nextAttempt,
        last_attempt_at: new Date(now).toISOString(),
        next_retry_at: nextRetryAt,
      };
      state.supervisor.halt_reason = 'RESOURCE_EXHAUSTED';
      state.supervisor.halt_details = `Resource exhausted, retry ${nextAttempt}/${MAX_RESOURCE_EXHAUSTED_RETRIES} in ${backoffMinutes} minutes`;
      
      // Persist state with retry info
      const persistStartTime = Date.now();
      await persistence.writeState(state);
      const persistDuration = Date.now() - persistStartTime;
      logPerformance('ResourceExhaustedRetryStatePersist', persistDuration, { iteration, attempt: nextAttempt });
      
      log(`[Iteration ${iteration}] Task ${task.task_id}: Resource exhausted - scheduling retry ${nextAttempt}/${MAX_RESOURCE_EXHAUSTED_RETRIES} in ${backoffMinutes} minutes`);
      logVerbose('ControlLoop', 'Resource exhausted retry scheduled', {
        iteration,
        task_id: task.task_id,
        attempt: nextAttempt,
        max_retries: MAX_RESOURCE_EXHAUSTED_RETRIES,
        backoff_ms: backoffMs,
        backoff_minutes: backoffMinutes,
        next_retry_at: nextRetryAt,
      });
      
      // Log to audit
      await auditLogger.append({
        event: 'RESOURCE_EXHAUSTED_RETRY',
        timestamp: new Date().toISOString(),
        task_id: task.task_id,
        iteration,
        retry_attempt: nextAttempt,
        max_retries: MAX_RESOURCE_EXHAUSTED_RETRIES,
        backoff_minutes: backoffMinutes,
        next_retry_at: nextRetryAt,
      });
      
      // Continue loop to wait for retry
      await sleep(1000);
      continue;
    }
    
    // Only immediately halt on critical failures (execution failure, blocked)
    // AMBIGUITY and ASKED_QUESTION will be handled after validation (may be false positives)
    // RESOURCE_EXHAUSTED is handled above with retry logic
    const criticalHaltReasons: HaltReason[] = ['BLOCKED', 'OUTPUT_FORMAT_INVALID', 'PROVIDER_CIRCUIT_BROKEN'];
    if (haltReason && criticalHaltReasons.includes(haltReason as any)) {
      log(`[Iteration ${iteration}] Task ${task.task_id}: Critical halt - ${haltReason}`);
      logVerbose('ControlLoop', 'Critical halt condition, halting immediately', {
        iteration,
        task_id: task.task_id,
        halt_reason: haltReason,
        is_critical: true,
      });
      logStateTransition(state.supervisor.status, 'HALTED', {
        iteration,
        task_id: task.task_id,
        reason: haltReason,
      });
      await halt(
        state,
        haltReason,
        persistence,
        auditLogger,
        `Provider output triggered halt: ${haltReason}`
      );
    }

    // providerOutput available via providerResult.rawOutput if needed

    // 10. Validate output deterministically (even if AMBIGUITY/ASKED_QUESTION detected)
    // Use project-specific sandbox path (same as CLI / Agent working directory)
    log(`[Iteration ${iteration}] Task ${task.task_id}: Validating output...`);
    logVerbose('ControlLoop', 'Starting validation', {
      iteration,
      task_id: task.task_id,
      sandbox_cwd: sandboxCwd,
      has_expected_json_schema: !!task.expected_json_schema,
      has_required_artifacts: !!(task.required_artifacts && task.required_artifacts.length > 0),
      tests_required: task.tests_required || false,
      acceptance_criteria_count: task.acceptance_criteria?.length || 0,
    });
    const validationStartTime = Date.now();
    let validationReport: ValidationReport = await validateTaskOutput(
      task,
      providerResult,
      sandboxCwd,
      projectId
    );
    const validationDuration = Date.now() - validationStartTime;
    analyticsService.recordValidation(
      task.task_id, 
      validationDuration, 
      validationReport.valid
    );
    log(`[Iteration ${iteration}] Task ${task.task_id}: Validation completed in ${validationDuration}ms`);
    log(`[Iteration ${iteration}] Task ${task.task_id}: Validation result: ${validationReport.valid ? 'PASS' : 'FAIL'}`);
    logPerformance('Validation', validationDuration, {
      iteration,
      task_id: task.task_id,
      valid: validationReport.valid,
      rules_passed_count: validationReport.rules_passed?.length || 0,
      rules_failed_count: validationReport.rules_failed?.length || 0,
    });
    if (!validationReport.valid) {
      log(`[Iteration ${iteration}] Task ${task.task_id}: Validation reason: ${validationReport.reason}`);
      log(`[Iteration ${iteration}] Task ${task.task_id}: Rules passed: ${validationReport.rules_passed?.join(', ') || 'none'}`);
      log(`[Iteration ${iteration}] Task ${task.task_id}: Rules failed: ${validationReport.rules_failed?.join(', ') || 'none'}`);
      logVerbose('ControlLoop', 'Validation failed', {
        iteration,
        task_id: task.task_id,
        reason: validationReport.reason,
        rules_passed: validationReport.rules_passed || [],
        rules_failed: validationReport.rules_failed || [],
        rules_passed_count: validationReport.rules_passed?.length || 0,
        rules_failed_count: validationReport.rules_failed?.length || 0,
      });

      // Policy Enforcement: Increment error count on validation failure
      if (providerResult.sessionId && state.active_sessions?.[featureId]) {
        state.active_sessions[featureId].error_count++;
        log(`[Iteration ${iteration}] Task ${task.task_id}: Session error count incremented to ${state.active_sessions[featureId].error_count}`);
      }

      // NEW: Try Helper Agent command generation
      log(`[Iteration ${iteration}] Task ${task.task_id}: Attempting Helper Agent command generation...`);
      const helperAgentMode = process.env.HELPER_AGENT_MODE || 'auto';
      
      // Resolve helper session
      const helperFeatureId = `helper:${featureId}`;
      const helperSessionId = await sessionManager.resolveSession(
        task.tool,
        helperFeatureId,
        undefined,
        state
      );
      
      if (helperSessionId) {
         log(`[Iteration ${iteration}] Task ${task.task_id}: Resuming helper session: ${helperSessionId}`);
      }

      logVerbose('ControlLoop', 'Starting Helper Agent command generation', {
        iteration,
        task_id: task.task_id,
        helper_agent_mode: helperAgentMode,
        failed_criteria_count: validationReport.failed_criteria?.length || 0,
        helper_session_id: helperSessionId,
      });

      try {
        const helperStartTime = Date.now();
        const commandGeneration = await generateValidationCommands(
          providerResult.rawOutput || providerResult.stdout || '',
          validationReport.failed_criteria || [],
          sandboxCwd,
          cliAdapter,
          helperAgentMode,
          sandboxRoot,
          projectId,
          task.task_id,
          helperSessionId,
          helperFeatureId
        );
        analyticsService.recordHelperAgent(task.task_id, Date.now() - helperStartTime);
        
        // Save helper session back to state
        if (commandGeneration.sessionId) {
            if (!state.active_sessions) state.active_sessions = {};
            
            const currentHelperSession = state.active_sessions[helperFeatureId];
            const newTokens = commandGeneration.usage?.tokens || 0;
            const accumulatedTokens = (helperSessionId === commandGeneration.sessionId && currentHelperSession) 
                ? (currentHelperSession.total_tokens || 0) + newTokens 
                : newTokens;

            state.active_sessions[helperFeatureId] = {
                session_id: commandGeneration.sessionId,
                provider: task.tool,
                last_used: new Date().toISOString(),
                error_count: 0, // Helpers don't accumulate errors in the same way
                total_tokens: accumulatedTokens,
                feature_id: helperFeatureId,
                task_id: task.task_id
            };
            log(`[Iteration ${iteration}] Task ${task.task_id}: Helper session ${commandGeneration.sessionId} updated (Tokens: ${accumulatedTokens})`);
        }

        log(`[Iteration ${iteration}] Task ${task.task_id}: Helper Agent result: isValid=${commandGeneration.isValid}, commands=${commandGeneration.verificationCommands.length}`);
        logVerbose('ControlLoop', 'Helper Agent command generation completed', {
          iteration,
          task_id: task.task_id,
          is_valid: commandGeneration.isValid,
          commands_count: commandGeneration.verificationCommands.length,
          reasoning: commandGeneration.reasoning,
        });

        if (commandGeneration.isValid) {
          // Helper Agent determined validation passes, skip interrogation
          log(`[Iteration ${iteration}] Task ${task.task_id}: ✅ Helper Agent confirmed validation via command generation`);
          logVerbose('ControlLoop', 'Helper Agent confirmed validation', {
            iteration,
            task_id: task.task_id,
            reasoning: commandGeneration.reasoning,
          });
          validationReport.valid = true;
          validationReport.reason = `Helper Agent confirmed validation via command generation: ${commandGeneration.reasoning || 'no reasoning provided'}`;
          // Continue to success handling (will be handled by code after this block)
        } else if (commandGeneration.verificationCommands.length > 0) {
          // Execute generated commands
          log(`[Iteration ${iteration}] Task ${task.task_id}: Executing ${commandGeneration.verificationCommands.length} verification commands...`);
          logVerbose('ControlLoop', 'Executing verification commands', {
            iteration,
            task_id: task.task_id,
            commands_count: commandGeneration.verificationCommands.length,
            commands: commandGeneration.verificationCommands,
          });

          const commandResults = await executeVerificationCommands(
            commandGeneration.verificationCommands,
            sandboxCwd
          );

          log(`[Iteration ${iteration}] Task ${task.task_id}: Command execution result: ${commandResults.passed ? 'PASSED' : 'FAILED'}`);
          logVerbose('ControlLoop', 'Verification commands executed', {
            iteration,
            task_id: task.task_id,
            passed: commandResults.passed,
            total_commands: commandResults.results.length,
            passed_commands: commandResults.results.filter(r => r.passed).length,
            failed_commands: commandResults.results.filter(r => !r.passed).length,
          });

          // Log command execution results
          if (sandboxRoot && projectId) {
            await appendPromptLog(
              {
                task_id: task.task_id,
                iteration: 0,
                type: 'RESPONSE', // Using RESPONSE type for command execution results
                content: `Command execution results:\n${commandResults.results.map(r => `${r.command}: ${r.passed ? '`PASSED`' : '`FAILED`'} (exitCode=${r.exitCode})`).join('\n')}`,
                metadata: {
                  provider: cliAdapter.getProviderInUse(),
                  working_directory: sandboxCwd,
                  prompt_type: 'command_execution',
                  command_execution_passed: commandResults.passed,
                  command_execution_results: commandResults.results.map(r => ({
                    command: r.command,
                    exitCode: r.exitCode,
                    passed: r.passed,
                  })),
                },
              },
              sandboxRoot,
              projectId
            );
          }

          if (commandResults.passed) {
            // Commands passed, validation succeeds
            log(`[Iteration ${iteration}] Task ${task.task_id}: ✅ Verification commands passed`);
            logVerbose('ControlLoop', 'Verification commands passed', {
              iteration,
              task_id: task.task_id,
            });
            validationReport.valid = true;
            validationReport.reason = 'Verification commands passed';
            // Skip interrogation
          } else {
            // Commands failed, proceed to interrogation (existing flow)
            log(`[Iteration ${iteration}] Task ${task.task_id}: Verification commands failed, proceeding to interrogation`);
            logVerbose('ControlLoop', 'Verification commands failed, proceeding to interrogation', {
              iteration,
              task_id: task.task_id,
              failed_commands: commandResults.results.filter(r => !r.passed).map(r => r.command),
            });
          }
        } else {
          // No commands generated, proceed to interrogation (existing flow)
          log(`[Iteration ${iteration}] Task ${task.task_id}: No verification commands generated, proceeding to interrogation`);
          logVerbose('ControlLoop', 'No verification commands generated, proceeding to interrogation', {
            iteration,
            task_id: task.task_id,
            reasoning: commandGeneration.reasoning,
          });
        }
      } catch (error) {
        // Helper Agent failed, proceed to interrogation (existing flow)
        log(`[Iteration ${iteration}] Task ${task.task_id}: Helper Agent command generation failed: ${error instanceof Error ? error.message : String(error)}`);
        logVerbose('ControlLoop', 'Helper Agent command generation failed', {
          iteration,
          task_id: task.task_id,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue to interrogation (existing flow)
      }
    } else {
      logVerbose('ControlLoop', 'Validation passed', {
        iteration,
        task_id: task.task_id,
        rules_passed: validationReport.rules_passed || [],
        rules_passed_count: validationReport.rules_passed?.length || 0,
      });
    }

    // 11. Handle validation failure OR non-critical halts (AMBIGUITY/ASKED_QUESTION) → Generate fix prompt and retry
    // If validation passes but AMBIGUITY/ASKED_QUESTION detected, still retry with clarification prompt
    // NEW: If validation confidence is UNCERTAIN, enter interrogation phase before retry
    const needsRetry = !validationReport.valid || (haltReason && ['AMBIGUITY', 'ASKED_QUESTION', 'CURSOR_EXEC_FAILURE'].includes(haltReason));
    const needsInterrogation = !validationReport.valid && 
                                task.task_type !== 'behavioral' &&
                                (validationReport.confidence === 'UNCERTAIN' || 
                                 (validationReport.confidence === 'LOW' && validationReport.uncertain_criteria && validationReport.uncertain_criteria.length > 0));
    
    // NEW: Check if interrogation already performed for this task attempt
    const retryKey = `retry_count_${task.task_id}`;
    const retryCount = (state.supervisor as any)[retryKey] || 0;
    const interrogationKey = `interrogation_performed_${task.task_id}_attempt_${retryCount}`;
    const interrogationAlreadyPerformed = (state.supervisor as any)[interrogationKey] || false;
    
    logVerbose('ControlLoop', 'Evaluating retry/interrogation need', {
      iteration,
      task_id: task.task_id,
      needs_retry: needsRetry,
      needs_interrogation: needsInterrogation,
      validation_valid: validationReport.valid,
      validation_confidence: validationReport.confidence,
      halt_reason: haltReason,
      uncertain_criteria_count: validationReport.uncertain_criteria?.length || 0,
      failed_criteria_count: validationReport.failed_criteria?.length || 0,
      retry_count: retryCount,
      interrogation_already_performed: interrogationAlreadyPerformed,
    });
    
    // Interrogation phase: Ask agent about uncertain/failed criteria
    // Only interrogate if not already performed for this task attempt
    if (needsInterrogation && !interrogationAlreadyPerformed) {
      log(`[Iteration ${iteration}] Task ${task.task_id}: Entering interrogation phase`);
      logVerbose('ControlLoop', 'Starting interrogation phase', {
        iteration,
        task_id: task.task_id,
        uncertain_criteria: validationReport.uncertain_criteria || [],
        failed_criteria: validationReport.failed_criteria || [],
      });

      // Mark interrogation as performed for this task attempt
      // CRITICAL: Persist state immediately to prevent duplicate interrogations if control loop continues
      (state.supervisor as any)[interrogationKey] = true;
      log(`[Iteration ${iteration}] Marking interrogation as performed for task ${task.task_id}, attempt ${retryCount}`);
      await persistence.writeState(state);
      log(`[Iteration ${iteration}] State persisted with interrogation flag to prevent duplicate interrogations`);

      const interrogationStartTime = Date.now();
      const interrogationSession = await interrogateAgent(
        task,
        validationReport.failed_criteria || [],
        validationReport.uncertain_criteria || [],
        minimalState,
        sandboxCwd,
        cliAdapter,
        1, // max 1 question per criterion
        sandboxRoot,
        projectId
      );
      const interrogationDuration = Date.now() - interrogationStartTime;
      analyticsService.recordInterrogation(task.task_id, interrogationSession.interrogation_results.length, interrogationDuration);
      
      log(`[Iteration ${iteration}] Task ${task.task_id}: Interrogation completed in ${interrogationDuration}ms`);
      log(`Interrogation result: ${interrogationSession.all_criteria_satisfied ? 'ALL SATISFIED' : `${interrogationSession.remaining_failed_criteria.length} still failed`}`);
      logVerbose('ControlLoop', 'Interrogation phase completed', {
        iteration,
        task_id: task.task_id,
        all_criteria_satisfied: interrogationSession.all_criteria_satisfied,
        remaining_failed_criteria_count: interrogationSession.remaining_failed_criteria.length,
        total_questions_asked: interrogationSession.interrogation_results.length,
        duration_ms: interrogationDuration,
      });

      // If interrogation confirms all criteria satisfied, mark task as complete
      if (interrogationSession.all_criteria_satisfied) {
        log(`[Iteration ${iteration}] Task ${task.task_id}: ✅ All criteria confirmed COMPLETE via interrogation`);
        logVerbose('ControlLoop', 'Task completed via interrogation', {
          iteration,
          task_id: task.task_id,
          interrogation_questions: interrogationSession.interrogation_results.length,
        });
        
        // Update validation report to reflect completion
        validationReport = {
          valid: true,
          rules_passed: [...(validationReport.rules_passed || []), 'interrogation_confirmed'],
          rules_failed: [],
          confidence: 'HIGH',
        };
        // Skip to success handling (step 12) - will be handled by the code after this if block
      } else {
        // Interrogation didn't resolve all criteria, update failed criteria and proceed with retry
        log(`[Iteration ${iteration}] Task ${task.task_id}: Interrogation did not resolve all criteria, proceeding with retry`);
        logVerbose('ControlLoop', 'Interrogation incomplete, proceeding to retry', {
          iteration,
          task_id: task.task_id,
          remaining_failed_criteria: interrogationSession.remaining_failed_criteria,
        });
        
        // Update validation report with remaining failed criteria
        validationReport.failed_criteria = interrogationSession.remaining_failed_criteria;
        validationReport.reason = `After interrogation, ${interrogationSession.remaining_failed_criteria.length} criteria still failed: ${interrogationSession.remaining_failed_criteria.join(', ')}`;
      }
    }
    
    if (needsRetry) {
      // Track retry attempts for this task
      const retryKey = `retry_count_${task.task_id}`;
      const retryCount = (state.supervisor as any)[retryKey] || 0;
      const maxRetries = task.retry_policy?.max_retries || 1;
      
      // NEW: Repeated Error Detection
      const lastErrorKey = `last_error_${task.task_id}`;
      const repeatedCountKey = `repeated_error_count_${task.task_id}`;
      const previousError = (state.supervisor as any)[lastErrorKey];
      const currentError = validationReport.reason;
      const isRepeatedError = previousError === currentError;
      
      let repeatedErrorCount = (state.supervisor as any)[repeatedCountKey] || 0;
      
      if (isRepeatedError) {
        repeatedErrorCount++;
      } else {
        repeatedErrorCount = 0;
      }
      
      (state.supervisor as any)[lastErrorKey] = currentError;
      (state.supervisor as any)[repeatedCountKey] = repeatedErrorCount;

      if (repeatedErrorCount >= 3) {
        log(`[Iteration ${iteration}] Task ${task.task_id}: Repeated error limit (3) exceeded - blocking task`);
        logVerbose('ControlLoop', 'Blocking task due to repeated errors', {
          iteration,
          task_id: task.task_id,
          error: currentError,
          repeated_count: repeatedErrorCount,
        });
        
        logStateTransition('TASK_IN_PROGRESS', 'TASK_BLOCKED', {
          iteration,
          task_id: task.task_id,
          reason: 'repeated_validation_error',
        });
        
        if (!state.blocked_tasks) {
          state.blocked_tasks = [];
        }
        state.blocked_tasks.push({
          task_id: task.task_id,
          blocked_at: new Date().toISOString(),
          reason: `Validation failed with identical error 3 times in a row: ${currentError}`,
        });
        
        state.current_task = undefined;
        
        await auditLogger.append({
          event: 'TASK_BLOCKED',
          task_id: task.task_id,
          reason: `Repeated validation error limit exceeded: ${currentError}`,
          validation_summary: validationReport,
          timestamp: new Date().toISOString(),
        });
        
        await persistence.writeState(state);
        
        // Finalize analytics for the blocked task
        await analyticsService.finalizeTask(task.task_id, 'BLOCKED', sandboxRoot, projectId);
        
        continue;
      }

      log(`[Iteration ${iteration}] Task ${task.task_id}: Retry needed (attempt ${retryCount + 1}/${maxRetries})${isRepeatedError ? ` [REPEATED ERROR ${repeatedErrorCount}/3]` : ''}`);
      analyticsService.recordRetry(task.task_id, !validationReport.valid ? 'validation_failed' : 'ambiguity_or_question');
      logVerbose('ControlLoop', 'Retry required', {
        iteration,
        task_id: task.task_id,
        retry_count: retryCount,
        max_retries: maxRetries,
        is_repeated: isRepeatedError,
        retry_reason: !validationReport.valid ? 'validation_failed' : 'ambiguity_or_question',
        validation_reason: validationReport.reason,
        halt_reason: haltReason,
      });
      
      if (retryCount >= maxRetries) {
        // Max retries exceeded
        // NEW: Before blocking, do final interrogation to confirm work is truly incomplete
        log(`[Iteration ${iteration}] Task ${task.task_id}: Max retries (${maxRetries}) exceeded - performing final interrogation`);
        logVerbose('ControlLoop', 'Max retries exceeded, performing final interrogation', {
          iteration,
          task_id: task.task_id,
          retry_count: retryCount,
          max_retries: maxRetries,
          validation_reason: validationReport.reason,
        });

        // Final interrogation with remaining failed criteria
        const finalInterrogationStartTime = Date.now();
        const finalInterrogation = await interrogateAgent(
          task,
          validationReport.failed_criteria || [],
          [],
          minimalState,
          sandboxCwd,
          cliAdapter,
          0, // Final check: max 0 questions per criterion
          sandboxRoot,
          projectId
        );
        const finalInterrogationDuration = Date.now() - finalInterrogationStartTime;
        
        log(`[Iteration ${iteration}] Task ${task.task_id}: Final interrogation completed in ${finalInterrogationDuration}ms`);
        logVerbose('ControlLoop', 'Final interrogation completed', {
          iteration,
          task_id: task.task_id,
          all_criteria_satisfied: finalInterrogation.all_criteria_satisfied,
          remaining_failed_criteria_count: finalInterrogation.remaining_failed_criteria.length,
        });

        // Only block if final interrogation confirms incomplete
        if (!finalInterrogation.all_criteria_satisfied && finalInterrogation.remaining_failed_criteria.length > 0) {
          log(`[Iteration ${iteration}] Task ${task.task_id}: Final interrogation confirms INCOMPLETE - blocking task`);
          logVerbose('ControlLoop', 'Blocking task after final interrogation', {
            iteration,
            task_id: task.task_id,
            remaining_failed_criteria: finalInterrogation.remaining_failed_criteria,
          });
          
          logStateTransition('TASK_IN_PROGRESS', 'TASK_BLOCKED', {
            iteration,
            task_id: task.task_id,
            reason: 'max_retries_exceeded_and_final_interrogation_confirmed_incomplete',
          });
          
          if (!state.blocked_tasks) {
            state.blocked_tasks = [];
          }
          state.blocked_tasks.push({
            task_id: task.task_id,
            blocked_at: new Date().toISOString(),
            reason: `Validation failed after ${maxRetries} retries and final interrogation confirmed incomplete: ${finalInterrogation.remaining_failed_criteria.join(', ')}`,
          });
          
          // Clear current_task
          state.current_task = undefined;
          
          // Log the blocked task
          await auditLogger.append({
            event: 'TASK_BLOCKED',
            task_id: task.task_id,
            reason: `Max retries (${maxRetries}) exceeded and final interrogation confirmed incomplete`,
            validation_summary: validationReport,
            timestamp: new Date().toISOString(),
          });
          
          // Persist state and continue to next task
          const blockPersistStartTime = Date.now();
          await persistence.writeState(state);
          const blockPersistDuration = Date.now() - blockPersistStartTime;
          logPerformance('BlockedTaskStatePersist', blockPersistDuration, { iteration, task_id: task.task_id });
          
          // Finalize analytics for the blocked task
          await analyticsService.finalizeTask(task.task_id, 'BLOCKED', sandboxRoot, projectId);
          
          continue; // Skip to next iteration
        } else {
          // Final interrogation confirmed completion - mark as complete
          log(`[Iteration ${iteration}] Task ${task.task_id}: ✅ Final interrogation confirmed COMPLETE - marking task complete`);
          logVerbose('ControlLoop', 'Task completed after final interrogation', {
            iteration,
            task_id: task.task_id,
          });
          
          validationReport = {
            valid: true,
            rules_passed: [...(validationReport.rules_passed || []), 'final_interrogation_confirmed'],
            rules_failed: [],
            confidence: 'HIGH',
          };
          // Skip to success handling (step 12) - will be handled by the code after this if block
        }
      }
      
      // Increment retry count
      (state.supervisor as any)[retryKey] = retryCount + 1;
      log(`[Iteration ${iteration}] Task ${task.task_id}: Retry attempt ${retryCount + 1}/${maxRetries}`);
      
      // Build fix/clarification prompt
      const promptBuildStartTime = Date.now();
      let fixPrompt: string;
      let promptType = '';
      let logType: 'FIX_PROMPT' | 'CLARIFICATION_PROMPT' = 'FIX_PROMPT';
      if (!validationReport.valid) {
        // Validation failed - use fix prompt with validation feedback
        log(`[Iteration ${iteration}] Task ${task.task_id}: Building fix prompt (validation failed)`);
        promptType = isRepeatedError ? 'strict_fix' : 'fix';
        logType = 'FIX_PROMPT';
        fixPrompt = buildFixPrompt(task, minimalState, validationReport);
        
        if (isRepeatedError) {
          fixPrompt += '\n\n**STRICT ADHERENCE REQUIRED**: Your previous attempt failed with the EXACT same error. You MUST change your approach or provide more detailed evidence.';
        }
      } else if (haltReason && ['AMBIGUITY', 'ASKED_QUESTION'].includes(haltReason)) {
        // Validation passed but ambiguity/question detected - use clarification prompt
        log(`[Iteration ${iteration}] Task ${task.task_id}: Building clarification prompt (${haltReason})`);
        promptType = 'clarification';
        logType = 'CLARIFICATION_PROMPT';
        fixPrompt = buildClarificationPrompt(task, minimalState, haltReason as 'AMBIGUITY' | 'ASKED_QUESTION');
      } else {
        // Should not reach here, but fallback to fix prompt
        log(`[Iteration ${iteration}] Task ${task.task_id}: Building fix prompt (fallback)`);
        promptType = 'fix_fallback';
        logType = 'FIX_PROMPT';
        fixPrompt = buildFixPrompt(task, minimalState, validationReport);
      }
      const promptBuildDuration = Date.now() - promptBuildStartTime;
      logPerformance('FixPromptBuild', promptBuildDuration, {
        iteration,
        task_id: task.task_id,
        prompt_type: promptType,
        prompt_length: fixPrompt.length,
      });
      logVerbose('ControlLoop', 'Fix/clarification prompt built', {
        iteration,
        task_id: task.task_id,
        prompt_type: promptType,
        prompt_length: fixPrompt.length,
        retry_count: retryCount + 1,
      });

      // Log fix/clarification prompt to prompts.log.jsonl
      await appendPromptLog(
        {
          task_id: task.task_id,
          iteration,
          type: logType,
          content: fixPrompt,
          metadata: {
            agent_mode: agentMode,
            provider: cliAdapter.getProviderInUse(),
            working_directory: sandboxCwd,
            prompt_length: fixPrompt.length,
            intent: task.intent,
            prompt_type: promptType,
            retry_count: retryCount + 1,
          },
        },
        sandboxRoot,
        projectId
      );
      
      log(`[Iteration ${iteration}] Task ${task.task_id}: Executing fix/clarification attempt...`);
      const fixStartTime = Date.now();
      const fixProviderResult = await cliAdapter.execute(fixPrompt, sandboxCwd, agentMode, resolvedSessionId);
      const fixDuration = Date.now() - fixStartTime;
      log(`[Iteration ${iteration}] Task ${task.task_id}: Fix attempt completed in ${fixDuration}ms, exit code: ${fixProviderResult.exitCode}`);
      logPerformance('FixCLIAdapterExecution', fixDuration, {
        iteration,
        task_id: task.task_id,
        exit_code: fixProviderResult.exitCode,
        prompt_type: promptType,
        retry_count: retryCount + 1,
      });
      logVerbose('ControlLoop', 'Fix/clarification attempt completed', {
        iteration,
        task_id: task.task_id,
        exit_code: fixProviderResult.exitCode,
        stdout_length: fixProviderResult.stdout?.length || 0,
        stderr_length: fixProviderResult.stderr?.length || 0,
        prompt_type: promptType,
        retry_count: retryCount + 1,
      });

      // Log fix/clarification response to prompts.log.jsonl
      const fixResponseContent = fixProviderResult.stdout || fixProviderResult.rawOutput || '';
      await appendPromptLog(
        {
          task_id: task.task_id,
          iteration,
          type: 'RESPONSE',
          content: fixResponseContent,
          metadata: {
            agent_mode: agentMode,
            provider: cliAdapter.getProviderInUse(),
            working_directory: sandboxCwd,
            response_length: fixResponseContent.length,
            stdout_length: fixProviderResult.stdout?.length || 0,
            stderr_length: fixProviderResult.stderr?.length || 0,
            exit_code: fixProviderResult.exitCode,
            duration_ms: fixDuration,
            prompt_type: promptType,
            retry_count: retryCount + 1,
          },
        },
        sandboxRoot,
        projectId
      );

      // Update final prompt and response for audit log
      finalPrompt = fixPrompt;
      finalResponse = fixResponseContent;
      
      // Check for hard halts on fix/clarification attempt
      const fixHaltCheckStartTime = Date.now();
      const fixHaltReason = checkHardHalts({
        ...fixProviderResult,
        requiredKeys: [],
      });
      const fixHaltCheckDuration = Date.now() - fixHaltCheckStartTime;
      logPerformance('FixHaltDetection', fixHaltCheckDuration, {
        iteration,
        task_id: task.task_id,
        halt_reason: fixHaltReason || 'none',
      });
      logVerbose('ControlLoop', 'Fix attempt halt check completed', {
        iteration,
        task_id: task.task_id,
        halt_reason: fixHaltReason,
        retry_count: retryCount + 1,
      });
      
      // Only halt on critical failures during fix attempt
      const criticalHaltReasons: HaltReason[] = ['BLOCKED', 'OUTPUT_FORMAT_INVALID', 'PROVIDER_CIRCUIT_BROKEN'];
      if (fixHaltReason && criticalHaltReasons.includes(fixHaltReason as any)) {
        logVerbose('ControlLoop', 'Critical halt during fix attempt', {
          iteration,
          task_id: task.task_id,
          halt_reason: fixHaltReason,
          retry_count: retryCount + 1,
        });
        logStateTransition(state.supervisor.status, 'HALTED', {
          iteration,
          task_id: task.task_id,
          reason: fixHaltReason,
          during_fix: true,
        });
        await halt(
          state,
          fixHaltReason,
          persistence,
          auditLogger,
          `Provider output triggered halt during fix attempt: ${fixHaltReason}`
        );
      }
      
      // Re-validate the fix/clarification attempt
      // Use project-specific sandbox path (same as CLI / Agent working directory)
      log(`[Iteration ${iteration}] Task ${task.task_id}: Re-validating fix attempt...`);
      logVerbose('ControlLoop', 'Re-validating fix attempt', {
        iteration,
        task_id: task.task_id,
        retry_count: retryCount + 1,
      });
      const fixValidationStartTime = Date.now();
      const fixValidationReport: ValidationReport = await validateTaskOutput(
        task,
        fixProviderResult,
        sandboxCwd,
        projectId
      );
      const fixValidationDuration = Date.now() - fixValidationStartTime;
      log(`[Iteration ${iteration}] Task ${task.task_id}: Fix validation result: ${fixValidationReport.valid ? 'PASS' : 'FAIL'}`);
      logPerformance('FixValidation', fixValidationDuration, {
        iteration,
        task_id: task.task_id,
        valid: fixValidationReport.valid,
        retry_count: retryCount + 1,
      });
      
      // Check if ambiguity/question still present
      const fixStillHasAmbiguity = fixHaltReason && ['AMBIGUITY', 'ASKED_QUESTION'].includes(fixHaltReason);
      logVerbose('ControlLoop', 'Fix validation completed', {
        iteration,
        task_id: task.task_id,
        validation_valid: fixValidationReport.valid,
        still_has_ambiguity: fixStillHasAmbiguity,
        halt_reason: fixHaltReason,
        retry_count: retryCount + 1,
      });
      
      if (!fixValidationReport.valid || fixStillHasAmbiguity) {
        // Fix/clarification attempt failed or still has ambiguity, persist retry count and mark task for retry
        log(`[Iteration ${iteration}] Task ${task.task_id}: Fix attempt failed, will retry on next iteration`);
        logVerbose('ControlLoop', 'Fix attempt failed, scheduling retry', {
          iteration,
          task_id: task.task_id,
          validation_valid: fixValidationReport.valid,
          still_has_ambiguity: fixStillHasAmbiguity,
          retry_count: retryCount + 1,
          max_retries: maxRetries,
        });
        (state.supervisor as any)[`retry_task`] = task; // Keep task for next iteration
        const retryPersistStartTime = Date.now();
        await persistence.writeState(state);
        const retryPersistDuration = Date.now() - retryPersistStartTime;
        logPerformance('RetryStatePersist', retryPersistDuration, { iteration, task_id: task.task_id });
        continue; // Will retry same task on next iteration
      }
      
      // Fix/clarification succeeded, replace validationReport and clear haltReason
      log(`[Iteration ${iteration}] Task ${task.task_id}: Fix attempt succeeded!`);
      logVerbose('ControlLoop', 'Fix attempt succeeded', {
        iteration,
        task_id: task.task_id,
        retry_count: retryCount + 1,
        validation_rules_passed: fixValidationReport.rules_passed?.length || 0,
      });
      validationReport = fixValidationReport;
      haltReason = null; // Clear halt reason since fix succeeded
    }

    // 12. On success:
    // - mutate state (iteration++, last_task_id, last_validation_report)
    const stateUpdateStartTime = Date.now();
    const previousIteration = state.supervisor.iteration || 0;
    state.supervisor.iteration = previousIteration + 1;
    state.supervisor.last_task_id = task.task_id;
    state.supervisor.last_validation_report = validationReport;
    
    logVerbose('ControlLoop', 'Updating state for task completion', {
      iteration,
      task_id: task.task_id,
      previous_iteration: previousIteration,
      new_iteration: state.supervisor.iteration,
    });
    
    // Mark task as completed
    if (!state.completed_tasks) {
      state.completed_tasks = [];
    }
    state.completed_tasks.push({
      task_id: task.task_id,
      completed_at: new Date().toISOString(),
      validation_report: validationReport,
    });
    
    // Clear current_task
    state.current_task = undefined;
    
    // Clear resource_exhausted_retry on successful completion
    if (state.supervisor.resource_exhausted_retry) {
      log(`[Iteration ${iteration}] Task ${task.task_id}: Clearing resource_exhausted_retry after successful completion`);
      delete state.supervisor.resource_exhausted_retry;
      if (state.supervisor.halt_reason === 'RESOURCE_EXHAUSTED') {
        delete state.supervisor.halt_reason;
        delete state.supervisor.halt_details;
      }
    }
    
    const stateUpdateDuration = Date.now() - stateUpdateStartTime;
    logPerformance('StateUpdate', stateUpdateDuration, { iteration, task_id: task.task_id });

    log(`[Iteration ${iteration}] Task ${task.task_id}: ✅ COMPLETED`);
    analyticsService.logSummary(task.task_id);
    await analyticsService.finalizeTask(task.task_id, 'COMPLETED', sandboxRoot, projectId);
    
    log(`[Iteration ${iteration}] Completed tasks: ${state.completed_tasks.length}`);
    logVerbose('ControlLoop', 'Task completed successfully', {
      iteration,
      task_id: task.task_id,
      completed_tasks_count: state.completed_tasks.length,
      total_iteration: state.supervisor.iteration,
      validation_rules_passed: validationReport.rules_passed?.length || 0,
      iteration_duration_ms: Date.now() - iterationStartTime,
    });
    logStateTransition('TASK_IN_PROGRESS', 'TASK_COMPLETED', {
      iteration,
      task_id: task.task_id,
    });

    // - persist state with full overwrite
    const persistStartTime = Date.now();
    await persistence.writeState(state);
    const persistDuration = Date.now() - persistStartTime;
    log(`[Iteration ${iteration}] State persisted`);
    logPerformance('StatePersist', persistDuration, {
      iteration,
      task_id: task.task_id,
      state_size: JSON.stringify(state).length,
    });
    logVerbose('ControlLoop', 'State persisted successfully', {
      iteration,
      task_id: task.task_id,
      state_size_bytes: JSON.stringify(state).length,
    });

    // - append audit log entry
    const auditLogStartTime = Date.now();
    // projectId is already defined earlier in the function scope
    await appendAuditLog(
      stateBefore,
      state,
      task,
      validationReport,
      sandboxRoot,
      projectId,
      finalPrompt,
      finalResponse
    );
    const auditLogDuration = Date.now() - auditLogStartTime;
    log(`[Iteration ${iteration}] Audit log appended`);
    logPerformance('AuditLogAppend', auditLogDuration, { iteration, task_id: task.task_id });
    
    const iterationDuration = Date.now() - iterationStartTime;
    logPerformance('Iteration', iterationDuration, {
      iteration,
      task_id: task.task_id,
      status: 'completed',
    });
    logVerbose('ControlLoop', 'Iteration completed', {
      iteration,
      task_id: task.task_id,
      total_duration_ms: iterationDuration,
      breakdown: {
        state_load_ms: stateLoadDuration,
        task_retrieval_ms: taskRetrievalDuration,
        prompt_build_ms: promptBuildDuration,
        provider_execution_ms: providerDuration,
        validation_ms: validationDuration,
        state_persist_ms: persistDuration,
        audit_log_ms: auditLogDuration,
      },
    });
  }
}

