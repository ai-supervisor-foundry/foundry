// Operator CLI Entrypoint
// Operator is the only authority
// Supervisor never self-recovers

import { Command } from 'commander';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import { loadState, persistState, PersistenceLayer } from '../services/persistence';
import { enqueueTask, getQueueKey, QueueAdapter, DualQueueAdapter, createQueue } from '../../domain/executors/taskQueue';
import { SupervisorState, Goal, Task, TaskMetrics } from '../../domain/types/types';
import { controlLoop } from '../services/controlLoop';
import { scheduler } from '../services/scheduler';
import { PromptBuilder } from '../../domain/agents/promptBuilder';
import { CLIAdapter } from '../../infrastructure/adapters/agents/providers/cliAdapter';
import { Validator } from '../services/validator';
import { validationCache } from '../services/validationCache';
import { AuditLogger } from '../../infrastructure/adapters/logging/auditLogger';
import { logVerbose as logVerboseShared, logPerformance as logPerformanceShared } from '../../infrastructure/adapters/logging/logger';
import { WorkerPool } from '../workers/workerPool';
import { FileLockManager } from '../../infrastructure/network/resilience/fileLockManager';
import { WorktreeManager } from '../../infrastructure/adapters/os/worktreeManager';
import { GoalCompletionChecker } from '../services/controlLoop/modules/goalCompletionChecker';
import { LoggerAdapter } from '../../infrastructure/adapters/logging/loggerAdapter';
import { PromptLoggerAdapter } from '../../infrastructure/adapters/logging/promptLoggerAdapter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Provider } from '../../domain/agents/enums/provider';
import { SessionMetrics } from '../../infrastructure/monitoring/sessionMetrics';

function logVerbose(component: string, message: string, data?: Record<string, unknown>): void {
  logVerboseShared(`CLI:${component}`, message, data);
}

function logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
  logPerformanceShared(`[CLI] ${operation}`, duration, metadata);
}

const program = new Command();

const result = dotenv.config();
if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

// Global options
program
  .requiredOption('--redis-host <host>', 'DragonflyDB host', 'localhost')
  .requiredOption('--redis-port <port>', 'DragonflyDB port', '6499')
  .requiredOption('--state-key <key>', 'Supervisor state key (operator-defined, fixed)', 'supervisor:state')
  .requiredOption('--queue-name <name>', 'Task queue name', 'tasks')
  .requiredOption('--queue-db <index>', 'Queue database index (must differ from state DB)', (value: string) => parseInt(value, 10), 2)
  .option('--state-db <index>', 'State database index', (value: string) => parseInt(value || '0', 10), 0)
  .option('--sandbox-root <path>', 'Sandbox root directory (relative to project root or absolute)', './sandbox');

/**
 * Initialize supervisor state
 * Creates initial state with explicit values
 */
async function initState(
  client: Redis,
  stateKey: string,
  executionMode: 'AUTO' | 'MANUAL',
  sandboxRoot: string
): Promise<void> {
  const startTime = Date.now();
  logVerbose('InitState', 'Initializing supervisor state', {
    state_key: stateKey,
    execution_mode: executionMode,
    sandbox_root: sandboxRoot,
  });
  
  // Check if state already exists
  const checkStartTime = Date.now();
  const existing = await client.get(stateKey);
  const checkDuration = Date.now() - checkStartTime;
  logPerformance('StateExistenceCheck', checkDuration, { state_key: stateKey });
  
  if (existing !== null) {
    logVerbose('InitState', 'State key already exists', {
      state_key: stateKey,
      existing_state_size: existing.length,
    });
    throw new Error(`State key ${stateKey} already exists. Use different key or clear existing state.`);
  }

  // Create initial state - no defaults, all explicit
  const stateCreationStartTime = Date.now();
  const initialState: SupervisorState = {
    supervisor: {
      status: 'HALTED', // Start halted, operator must resume
      iteration: 0,
    },
    goals: {}, // Empty — operator sets goals per project via set-goal
    queue: {
      exhausted: false,
    },
    last_updated: new Date().toISOString(),
    execution_mode: executionMode,
  };
  const stateCreationDuration = Date.now() - stateCreationStartTime;
  logPerformance('InitialStateCreation', stateCreationDuration, {
    state_key: stateKey,
    execution_mode: executionMode,
  });
  logVerbose('InitState', 'Initial state created', {
    state_key: stateKey,
    status: initialState.supervisor.status,
    execution_mode: initialState.execution_mode,
    state_size: JSON.stringify(initialState).length,
  });

  const persistStartTime = Date.now();
  await persistState(client, stateKey, initialState, sandboxRoot);
  const persistDuration = Date.now() - persistStartTime;
  logPerformance('InitialStatePersist', persistDuration, { state_key: stateKey });
  
  const totalDuration = Date.now() - startTime;
  logPerformance('InitState', totalDuration, { state_key: stateKey });
  console.log(`Initialized supervisor state at key: ${stateKey}`);
  logVerbose('InitState', 'State initialization completed', {
    state_key: stateKey,
    total_duration_ms: totalDuration,
  });
}

/**
 * Set goal
 * Operator explicitly sets the goal
 */
async function setGoal(
  client: Redis,
  stateKey: string,
  goalDescription: string,
  projectId: string
): Promise<void> {
  const startTime = Date.now();
  logVerbose('SetGoal', 'Setting supervisor goal', {
    state_key: stateKey,
    goal_description_length: goalDescription.length,
    project_id: projectId,
  });

  const loadStartTime = Date.now();
  const state = await loadState(client, stateKey);
  const loadDuration = Date.now() - loadStartTime;
  logPerformance('SetGoalStateLoad', loadDuration, { state_key: stateKey });

  const existingGoal = state.goals[projectId];
  logVerbose('SetGoal', 'State loaded', {
    state_key: stateKey,
    current_status: state.supervisor.status,
    existing_goal: existingGoal?.description,
    project_id: projectId,
  });

  // Upsert goal for this project
  state.goals[projectId] = {
    description: goalDescription,
    completed: existingGoal?.completed || false,
    project_id: projectId,
  };
  logVerbose('SetGoal', 'Goal upserted', {
    state_key: stateKey,
    project_id: projectId,
    new_goal_length: goalDescription.length,
    was_update: !!existingGoal,
  });

  const persistStartTime = Date.now();
  await persistState(client, stateKey, state);
  const persistDuration = Date.now() - persistStartTime;
  logPerformance('SetGoalStatePersist', persistDuration, { state_key: stateKey });

  const totalDuration = Date.now() - startTime;
  logPerformance('SetGoal', totalDuration, { state_key: stateKey });
  console.log(`Goal set for project '${projectId}' successfully`);
  logVerbose('SetGoal', 'Goal set completed', {
    state_key: stateKey,
    project_id: projectId,
    total_duration_ms: totalDuration,
  });
}

/**
 * Enqueue task(s)
 * Operator explicitly enqueues one or more tasks
 * Supports both single task object and array of tasks
 */
async function enqueue(
  client: Redis,
  queueName: string,
  queueDbIndex: number,
  taskFile: string
): Promise<void> {
  const startTime = Date.now();
  logVerbose('Enqueue', 'Enqueuing tasks', {
    queue_name: queueName,
    queue_db_index: queueDbIndex,
    task_file: taskFile,
  });
  
  // Read task(s) from file
  const readStartTime = Date.now();
  const taskContent = await fs.readFile(taskFile, 'utf8');
  const readDuration = Date.now() - readStartTime;
  logPerformance('TaskFileRead', readDuration, { task_file: taskFile, file_size: taskContent.length });
  logVerbose('Enqueue', 'Task file read', {
    task_file: taskFile,
    file_size: taskContent.length,
  });
  
  const parseStartTime = Date.now();
  const parsed = JSON.parse(taskContent);
  const parseDuration = Date.now() - parseStartTime;
  logPerformance('TaskFileParse', parseDuration, { task_file: taskFile });

  // Handle both single task and array of tasks
  const tasks: Task[] = Array.isArray(parsed) ? parsed : [parsed];
  logVerbose('Enqueue', 'Tasks parsed', {
    task_count: tasks.length,
    is_array: Array.isArray(parsed),
  });

  // Validate each task structure
  const validationStartTime = Date.now();
  for (const task of tasks) {
    if (!task.task_id || !task.instructions || !task.acceptance_criteria || !task.project_id) {
      logVerbose('Enqueue', 'Task validation failed', {
        task_id: task.task_id || 'unknown',
        has_task_id: !!task.task_id,
        has_instructions: !!task.instructions,
        has_acceptance_criteria: !!task.acceptance_criteria,
        has_project_id: !!task.project_id,
      });
      throw new Error(`Task ${task.task_id || 'unknown'} must have task_id, project_id, instructions, and acceptance_criteria`);
    }
    if (!task.affects_files || !Array.isArray(task.affects_files) || task.affects_files.length === 0) {
      throw new Error(`Task ${task.task_id} must have a non-empty affects_files array (required for parallel execution)`);
    }
  }
  const validationDuration = Date.now() - validationStartTime;
  logPerformance('TaskValidation', validationDuration, { task_count: tasks.length });
  logVerbose('Enqueue', 'All tasks validated', {
    task_count: tasks.length,
    task_ids: tasks.map(t => t.task_id),
  });

  // Create queue client (separate DB index from state)
  const queueClientCreationStartTime = Date.now();
  const queueClient = new Redis({
    host: client.options.host || 'localhost',
    port: client.options.port || 6499,
    db: queueDbIndex,
  });
  const queueClientCreationDuration = Date.now() - queueClientCreationStartTime;
  logPerformance('QueueClientCreation', queueClientCreationDuration, {
    queue_db_index: queueDbIndex,
  });
  logVerbose('Enqueue', 'Queue client created', {
    queue_name: queueName,
    queue_db_index: queueDbIndex,
  });

  const dualQueue = new DualQueueAdapter(queueClient, queueName);

  // Enqueue all tasks via dual queue (auto-classifies ready vs waiting)
  const enqueueStartTime = Date.now();
  let readyCount = 0;
  let waitingCount = 0;
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskEnqueueStartTime = Date.now();
    logVerbose('Enqueue', 'Enqueuing individual task', {
      task_index: i + 1,
      total_tasks: tasks.length,
      task_id: task.task_id,
      intent: task.intent,
      depends_on: task.depends_on,
      affects_files: task.affects_files,
    });
    const classification = await dualQueue.enqueue(task);
    if (classification === 'ready') readyCount++;
    else waitingCount++;
    const taskEnqueueDuration = Date.now() - taskEnqueueStartTime;
    logPerformance('IndividualTaskEnqueue', taskEnqueueDuration, {
      task_id: task.task_id,
      task_index: i + 1,
      classification,
    });
    console.log(`Task ${task.task_id} enqueued → ${classification.toUpperCase()}`);
  }
  const enqueueDuration = Date.now() - enqueueStartTime;
  logPerformance('AllTasksEnqueue', enqueueDuration, { task_count: tasks.length, readyCount, waitingCount });
  console.log(`Summary: ${readyCount} ready, ${waitingCount} waiting`);

  // Close queue connection
  const closeStartTime = Date.now();
  await queueClient.quit();
  const closeDuration = Date.now() - closeStartTime;
  logPerformance('QueueClientClose', closeDuration, {});
  
  const totalDuration = Date.now() - startTime;
  logPerformance('Enqueue', totalDuration, { task_count: tasks.length });
  logVerbose('Enqueue', 'Enqueue operation completed', {
    task_count: tasks.length,
    total_duration_ms: totalDuration,
  });
}

/**
 * Halt supervisor
 * Sets status to HALTED
 */
async function halt(
  client: Redis,
  stateKey: string,
  reason?: string
): Promise<void> {
  const startTime = Date.now();
  logVerbose('Halt', 'Halting supervisor', {
    state_key: stateKey,
    reason: reason || 'none',
  });
  
  const loadStartTime = Date.now();
  const state = await loadState(client, stateKey);
  const loadDuration = Date.now() - loadStartTime;
  logPerformance('HaltStateLoad', loadDuration, { state_key: stateKey });
  logVerbose('Halt', 'State loaded', {
    state_key: stateKey,
    current_status: state.supervisor.status,
    current_halt_reason: state.supervisor.halt_reason,
  });
  
  const previousStatus = state.supervisor.status;
  state.supervisor.status = 'HALTED';
  if (reason) {
    state.supervisor.halt_reason = reason;
  }
  logVerbose('Halt', 'State updated for halt', {
    state_key: stateKey,
    previous_status: previousStatus,
    new_status: state.supervisor.status,
    halt_reason: state.supervisor.halt_reason,
  });

  const persistStartTime = Date.now();
  await persistState(client, stateKey, state);
  const persistDuration = Date.now() - persistStartTime;
  logPerformance('HaltStatePersist', persistDuration, { state_key: stateKey });
  
  const totalDuration = Date.now() - startTime;
  logPerformance('Halt', totalDuration, { state_key: stateKey });
  console.log('Supervisor halted');
  logVerbose('Halt', 'Halt operation completed', {
    state_key: stateKey,
    total_duration_ms: totalDuration,
  });
}

/**
 * Check supervisor status
 * Displays current supervisor state information
 */
async function status(
  client: Redis,
  stateKey: string
): Promise<void> {
  const startTime = Date.now();
  logVerbose('Status', 'Checking supervisor status', { state_key: stateKey });
  
  try {
    const loadStartTime = Date.now();
    const state = await loadState(client, stateKey);
    const loadDuration = Date.now() - loadStartTime;
    logPerformance('StatusStateLoad', loadDuration, { state_key: stateKey });
    
    // Display supervisor status
    console.log('\n=== Supervisor Status ===');
    console.log(`Status: ${state.supervisor.status}`);
    console.log(`Iteration: ${state.supervisor.iteration || 0}`);
    if (state.supervisor.last_task_id) {
      console.log(`Last Task ID: ${state.supervisor.last_task_id}`);
    }
    if (state.supervisor.halt_reason) {
      console.log(`Halt Reason: ${state.supervisor.halt_reason}`);
    }
    if (state.supervisor.halt_details) {
      console.log(`Halt Details: ${state.supervisor.halt_details}`);
    }
    
    // Display goals information
    console.log('\n=== Goals ===');
    const goalEntries = Object.entries(state.goals);
    if (goalEntries.length === 0) {
      console.log('No goals set. Use set-goal --project-id <id> --description <text>');
    } else {
      for (const [pid, goal] of goalEntries) {
        console.log(`  [${pid}] ${goal.completed ? 'DONE' : 'IN PROGRESS'}: ${goal.description}`);
      }
      const allDone = goalEntries.every(([, g]) => g.completed);
      console.log(`Overall: ${allDone ? 'All goals completed' : 'In progress'}`);
    }
    
    // Display active tasks
    const activeTasks = state.active_tasks ? Object.entries(state.active_tasks) : [];
    if (activeTasks.length > 0) {
      console.log('\n=== Active Tasks ===');
      for (const [taskId, active] of activeTasks) {
        console.log(`  [${active.worker_id}] ${taskId} (started: ${active.started_at})`);
        if (active.worktree_path) {
          console.log(`    Worktree: ${active.worktree_path}`);
        }
      }
    }

    // Display worker pool info
    if (state.worker_pool) {
      console.log('\n=== Worker Pool ===');
      console.log(`Active: ${state.worker_pool.active_count} / ${state.worker_pool.max_workers}`);
    }

    // Display file locks
    if (state.file_locks && Object.keys(state.file_locks).length > 0) {
      console.log('\n=== File Locks ===');
      for (const [filePath, lock] of Object.entries(state.file_locks)) {
        console.log(`  ${filePath} → ${lock.task_id} (worker: ${lock.worker_id})`);
      }
    }

    // Display queue information
    console.log('\n=== Queue ===');
    console.log(`Exhausted: ${state.queue.exhausted ? 'Yes' : 'No'}`);
    if (state.queue.ready_count !== undefined) {
      console.log(`Ready: ${state.queue.ready_count}`);
    }
    if (state.queue.waiting_count !== undefined) {
      console.log(`Waiting: ${state.queue.waiting_count}`);
    }
    
    // Display task statistics
    console.log('\n=== Task Statistics ===');
    console.log(`Completed Tasks: ${state.completed_tasks?.length || 0}`);
    if (state.completed_tasks && state.completed_tasks.length > 0) {
      console.log('  Recent completions:');
      state.completed_tasks.slice(-5).forEach((task) => {
        console.log(`    - ${task.task_id} (${task.completed_at})`);
      });
    }
    console.log(`Blocked Tasks: ${state.blocked_tasks?.length || 0}`);
    if (state.blocked_tasks && state.blocked_tasks.length > 0) {
      console.log('  Blocked tasks:');
      state.blocked_tasks.forEach((task) => {
        console.log(`    - ${task.task_id}: ${task.reason}`);
      });
    }
    
    // Display execution mode
    console.log('\n=== Execution Mode ===');
    console.log(`Mode: ${state.execution_mode || 'AUTO'}`);
    
    // Display last updated
    console.log('\n=== Metadata ===');
    console.log(`Last Updated: ${state.last_updated}`);
    
    // Display validation report if available
    if (state.supervisor.last_validation_report) {
      const report = state.supervisor.last_validation_report;
      console.log('\n=== Last Validation Report ===');
      console.log(`Valid: ${report.valid ? 'Yes' : 'No'}`);
      if (report.reason) {
        console.log(`Reason: ${report.reason}`);
      }
      console.log(`Rules Passed: ${report.rules_passed?.length || 0}`);
      if (report.rules_passed && report.rules_passed.length > 0) {
        report.rules_passed.forEach((rule) => {
          console.log(`  ✓ ${rule}`);
        });
      }
      console.log(`Rules Failed: ${report.rules_failed?.length || 0}`);
      if (report.rules_failed && report.rules_failed.length > 0) {
        report.rules_failed.forEach((rule) => {
          console.log(`  ✗ ${rule}`);
        });
      }
    }
    
    console.log('\n');
    
    const totalDuration = Date.now() - startTime;
    logPerformance('Status', totalDuration, { state_key: stateKey });
    logVerbose('Status', 'Status check completed', {
      state_key: stateKey,
      status: state.supervisor.status,
      total_duration_ms: totalDuration,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      console.error(`Error: State key '${stateKey}' not found. Initialize state first with 'init-state' command.`);
      logVerbose('Status', 'State key not found', {
        state_key: stateKey,
        error: error.message,
      });
    } else {
      console.error('Error checking status:', error instanceof Error ? error.message : String(error));
      logVerbose('Status', 'Status check failed', {
        state_key: stateKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}

/**
 * Show aggregated metrics from metrics.jsonl
 */
async function showMetrics(
  client: Redis,
  stateKey: string,
  sandboxRoot: string
): Promise<void> {
  logVerbose('Metrics', 'Showing metrics', { state_key: stateKey, sandbox_root: sandboxRoot });
  
  // 1. Load state to get project_ids
  const state = await loadState(client, stateKey);
  const projectIds = Object.keys(state.goals);
  if (projectIds.length === 0) {
    console.log('No goals set — no metrics available.');
    return;
  }
  // Show metrics for first project (or could iterate all)
  const projectId = projectIds[0];
  const metricsPath = path.join(sandboxRoot, projectId, 'metrics.jsonl');

  try {
    const content = await fs.readFile(metricsPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const metrics: TaskMetrics[] = lines.map(l => JSON.parse(l));

    if (metrics.length === 0) {
      console.log('No metrics found.');
      return;
    }

    // 2. Aggregate
    const totalTasks = metrics.length;
    const completedTasks = metrics.filter(m => m.status === 'COMPLETED').length;
    const failedTasks = metrics.filter(m => m.status === 'FAILED').length;
    const blockedTasks = metrics.filter(m => m.status === 'BLOCKED').length;
    
    const avgIterations = metrics.reduce((sum, m) => sum + m.iterations, 0) / totalTasks;
    const totalDuration = metrics.reduce((sum, m) => sum + (m.total_duration_ms || 0), 0);
    
    const totalPromptChars = metrics.reduce((sum, m) => sum + m.total_prompt_chars, 0);
    const totalResponseChars = metrics.reduce((sum, m) => sum + m.total_response_chars, 0);

    // 3. Display
    console.log('\n=== Supervisor Metrics Summary ===');
    console.log(`Total Tasks Processed: ${totalTasks}`);
    console.log(`Success Rate: ${((completedTasks / totalTasks) * 100).toFixed(1)}%`);
    console.log(`  - Completed: ${completedTasks}`);
    console.log(`  - Failed:    ${failedTasks}`);
    console.log(`  - Blocked:   ${blockedTasks}`);
    console.log(`Average Iterations per Task: ${avgIterations.toFixed(1)}`);
    console.log(`Total Execution Time: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
    console.log(`Total Characters (Prompt/Response): ${totalPromptChars} / ${totalResponseChars}`);
    
    // Find slowest task
    const slowestTask = [...metrics].sort((a, b) => (b.total_duration_ms || 0) - (a.total_duration_ms || 0))[0];
    if (slowestTask) {
      console.log(`Slowest Task: ${slowestTask.task_id} (${((slowestTask.total_duration_ms || 0) / 1000 / 60).toFixed(1)} mins)`);
    }

    console.log('\n');
  } catch (error) {
    console.log(`No metrics available at ${metricsPath}`);
  }

  const sessionMetricsPath = path.join(sandboxRoot, projectId, 'session-metrics.json');
  try {
    const sessionContent = await fs.readFile(sessionMetricsPath, 'utf8');
    const session = JSON.parse(sessionContent) as SessionMetrics & { updated_at?: string };
    console.log('=== Session Health ===');
    console.log(`Sessions Created: ${session.totalSessionsCreated}`);
    console.log(`Sessions Reused:  ${session.totalSessionsReused}`);
    console.log(`Reuse Rate:       ${session.reuseRate.toFixed(1)}%`);
    console.log(`Est. Token Savings: ${session.estimatedTokenSavings.toLocaleString()}`);
    console.log(`Avg Session Lifespan: ${session.avgSessionLifespan.toFixed(1)} iterations`);
    if (session.avgCacheHitRate > 0) {
      console.log(`Avg Cache Hit Rate: ${session.avgCacheHitRate.toFixed(1)}%`);
    }
    if (session.updated_at) {
      console.log(`Last Updated: ${session.updated_at}`);
    }
    console.log('\n');
  } catch {
    // Session metrics are optional until control loop has run
  }
}

/**
 * Resume supervisor
 * Sets status to RUNNING
 * No auto-resume - operator must explicitly resume
 */
async function resume(
  client: Redis,
  stateKey: string
): Promise<void> {
  const startTime = Date.now();
  logVerbose('Resume', 'Resuming supervisor', { state_key: stateKey });
  
  const loadStartTime = Date.now();
  const state = await loadState(client, stateKey);
  const loadDuration = Date.now() - loadStartTime;
  logPerformance('ResumeStateLoad', loadDuration, { state_key: stateKey });
  const goalCount = Object.keys(state.goals).length;
  logVerbose('Resume', 'State loaded', {
    state_key: stateKey,
    current_status: state.supervisor.status,
    current_halt_reason: state.supervisor.halt_reason,
    goal_count: goalCount,
  });

  // Validate that at least one goal is set
  if (goalCount === 0) {
    logVerbose('Resume', 'Resume failed: no goals set', {
      state_key: stateKey,
    });
    throw new Error('Cannot resume: no goals set. Use set-goal --project-id <id> --description <text> first.');
  }

  const previousStatus = state.supervisor.status;
  const previousHaltReason = state.supervisor.halt_reason;
  state.supervisor.status = 'RUNNING';
  state.supervisor.halt_reason = undefined;
  state.supervisor.halt_details = undefined;
  // Reset queue.exhausted to false when resuming (allows supervisor to check queue again)
  state.queue.exhausted = false;
  logVerbose('Resume', 'State updated for resume', {
    state_key: stateKey,
    previous_status: previousStatus,
    new_status: state.supervisor.status,
    previous_halt_reason: previousHaltReason,
  });

  const persistStartTime = Date.now();
  await persistState(client, stateKey, state);
  const persistDuration = Date.now() - persistStartTime;
  logPerformance('ResumeStatePersist', persistDuration, { state_key: stateKey });
  
  const totalDuration = Date.now() - startTime;
  logPerformance('Resume', totalDuration, { state_key: stateKey });
  console.log('Supervisor resumed');
  logVerbose('Resume', 'Resume operation completed', {
    state_key: stateKey,
    total_duration_ms: totalDuration,
  });
}

/**
 * Start supervisor control loop
 * Initializes all dependencies and runs the control loop
 */
async function start(
  redisHost: string,
  redisPort: number,
  stateKey: string,
  stateDb: number,
  queueName: string,
  queueDb: number,
  sandboxRoot: string
): Promise<void> {
  const startTime = Date.now();
  logVerbose('Start', 'Starting supervisor control loop', {
    redis_host: redisHost,
    redis_port: redisPort,
    state_key: stateKey,
    state_db: stateDb,
    queue_name: queueName,
    queue_db: queueDb,
    sandbox_root: sandboxRoot,
  });
  
  // Create Redis client for state
  const stateClientCreationStartTime = Date.now();
  const stateClient = new Redis({
    host: redisHost,
    port: redisPort,
    db: stateDb,
  });
  const stateClientCreationDuration = Date.now() - stateClientCreationStartTime;
  logPerformance('StateClientCreation', stateClientCreationDuration, {
    redis_host: redisHost,
    redis_port: redisPort,
    state_db: stateDb,
  });
  logVerbose('Start', 'State Redis client created', {
    redis_host: redisHost,
    redis_port: redisPort,
    state_db: stateDb,
  });

  // Create Redis client for queue
  const queueClientCreationStartTime = Date.now();
  const queueClient = createQueue(queueName, redisHost, redisPort, queueDb);
  const queueClientCreationDuration = Date.now() - queueClientCreationStartTime;
  logPerformance('QueueClientCreation', queueClientCreationDuration, {
    queue_name: queueName,
    queue_db: queueDb,
  });
  logVerbose('Start', 'Queue Redis client created', {
    queue_name: queueName,
    queue_db: queueDb,
  });

  try {
    // Validate state exists
    const stateLoadStartTime = Date.now();
    const state = await loadState(stateClient, stateKey, sandboxRoot);
    const stateLoadDuration = Date.now() - stateLoadStartTime;
    logPerformance('StartStateLoad', stateLoadDuration, { state_key: stateKey });
    const goalCount = Object.keys(state.goals).length;
    logVerbose('Start', 'State loaded', {
      state_key: stateKey,
      status: state.supervisor.status,
      iteration: state.supervisor.iteration,
      execution_mode: state.execution_mode,
      goal_count: goalCount,
      project_ids: Object.keys(state.goals),
    });

    // Validate that at least one goal is set
    if (goalCount === 0) {
      logVerbose('Start', 'Start failed: no goals set', {
        state_key: stateKey,
      });
      throw new Error('Cannot start: no goals set. Use set-goal --project-id <id> --description <text> first.');
    }

    // Initialize all dependencies
    const dependencyInitStartTime = Date.now();
    const persistence = new PersistenceLayer(stateClient, stateKey, sandboxRoot);
    const queue = new QueueAdapter(queueClient, queueName);
    const promptBuilder = new PromptBuilder();
    // Initialize CLIAdapters with Redis client for circuit breaker
    // Use stateClient for circuit breaker storage (same DB as state)
    const ttlSeconds = parseInt(process.env.CIRCUIT_BREAKER_TTL_SECONDS || '86400', 10);
    const { getActiveStrategy } = await import('../../config/agents/providers/strategies');
    const activeStrategy = await getActiveStrategy();
    logVerbose('Start', `Active provider strategy: ${activeStrategy.name}`, { strategy: process.env.PROVIDER_STRATEGY || '1' });
    const primaryAdapter = new CLIAdapter(stateClient, activeStrategy.primary, ttlSeconds, true);
    const secondaryAdapter = new CLIAdapter(stateClient, activeStrategy.secondary, ttlSeconds);
    const validator = new Validator();
    
    // Initialize validation cache with Redis
    validationCache.initialize(stateClient);

    const dependencyInitDuration = Date.now() - dependencyInitStartTime;
    logPerformance('DependencyInitialization', dependencyInitDuration, {});
    logVerbose('Start', 'Dependencies initialized', {
      /** @todo remove the commented out code below after experimentation, that all is good - Jan 1, 2026 */
      // gemini_stub_cli_path: process.env.GEMINI_STUB_CLI_PATH || 'gemini-stub',
      // gemini_cli_path: process.env.GEMINI_CLI_PATH || 'gemini',
      // copilot_cli_path: process.env.COPILOT_CLI_PATH || 'copilot',
      // codex_cli_path: process.env.CODEX_CLI_PATH || 'codex',
      // claude_cli_path: process.env.CLAUDE_CLI_PATH || 'claude',
      ...Object.values(Provider).map(provider => ({ [provider]: process.env[`${provider}_CLI_PATH`] || provider })),
      circuit_breaker_ttl_seconds: ttlSeconds,
    });
    
    // Determine audit log path — use first project or sandbox root
    const firstProjectId = Object.keys(state.goals)[0] || 'default';
    const logDir = path.join(sandboxRoot, firstProjectId);
    const logPath = path.join(logDir, 'audit.log.jsonl');
    const auditLogger = new AuditLogger(logPath);
    logVerbose('Start', 'Audit logger initialized', {
      project_id: firstProjectId,
      log_dir: logDir,
      log_path: logPath,
    });

    const promptsLogPath = path.join(logDir, 'logs', 'prompts.log.jsonl');
    const maxWorkers = parseInt(process.env.MAX_WORKERS || '1', 10);
    const fileLockTtl = parseInt(process.env.FILE_LOCK_TTL || '2100', 10);

    console.log('Starting supervisor...');
    console.log(`State key: ${stateKey}`);
    console.log(`Queue: ${queueName}`);
    console.log(`Sandbox root: ${sandboxRoot}`);
    console.log(`Projects: ${Object.keys(state.goals).join(', ')}`);
    console.log(`Workers: ${maxWorkers}`);
    console.log(`Audit log: ${logPath}`);
    console.log(`Prompts log: ${promptsLogPath}`);
    console.log('Press Ctrl+C to stop\n');

    if (maxWorkers > 1) {
      // Parallel mode — use scheduler with worker pool
      logVerbose('Start', 'Starting in PARALLEL mode', { maxWorkers, fileLockTtl });

      const dualQueue = new DualQueueAdapter(queueClient, queueName);
      const workerScriptPath = path.join(__dirname, '..', 'workers', 'worker.js');
      const workerPool = new WorkerPool(maxWorkers, workerScriptPath);
      const lockManager = new FileLockManager(stateClient, fileLockTtl);
      const worktreeManager = new WorktreeManager(sandboxRoot);
      const logger = new LoggerAdapter();
      const promptLogger = new PromptLoggerAdapter();
      const goalChecker = new GoalCompletionChecker(
        primaryAdapter,
        logger,
        promptLogger,
        sandboxRoot
      );

      const workerConfig = {
        sandboxRoot,
        redisHost,
        redisPort,
        stateKey,
        queueDb,
        providerStrategy: process.env.PROVIDER_STRATEGY || '1',
        circuitBreakerTtl: ttlSeconds,
      };

      const schedulerStartTime = Date.now();
      await scheduler(
        persistence,
        dualQueue,
        workerPool,
        lockManager,
        worktreeManager,
        goalChecker,
        auditLogger,
        workerConfig,
        sandboxRoot,
        logger,
      );
      const schedulerDuration = Date.now() - schedulerStartTime;
      logPerformance('Scheduler', schedulerDuration, {});
      logVerbose('Start', 'Scheduler completed', { total_duration_ms: schedulerDuration });
    } else {
      // Sequential mode — use existing control loop
      logVerbose('Start', 'Starting in SEQUENTIAL mode (MAX_WORKERS=1)', {});

      const controlLoopStartTime = Date.now();
      await controlLoop(
        persistence,
        queue,
        promptBuilder,
        primaryAdapter,
        secondaryAdapter,
        validator,
        auditLogger,
        sandboxRoot
      );
      const controlLoopDuration = Date.now() - controlLoopStartTime;
      logPerformance('ControlLoop', controlLoopDuration, {});
      logVerbose('Start', 'Control loop completed', { total_duration_ms: controlLoopDuration });
    }
  } catch (error) {
    logVerbose('Start', 'Supervisor error occurred', {
      error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
    });
    console.error('Supervisor error:', error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    // Cleanup connections
    const cleanupStartTime = Date.now();
    await stateClient.quit();
    await queueClient.quit();
    const cleanupDuration = Date.now() - cleanupStartTime;
    logPerformance('ConnectionCleanup', cleanupDuration, {});
    logVerbose('Start', 'Connections cleaned up', {});
    
    const totalDuration = Date.now() - startTime;
    logPerformance('Start', totalDuration, {});
  }
}

// Command: init-state
program
  .command('init-state')
  .description('Initialize supervisor state')
  .option('--execution-mode <mode>', 'Execution mode: AUTO or MANUAL (default: AUTO)', 'AUTO')
  .action(async (options) => {
    const globalOpts = program.opts();
    const client = new Redis({
      host: globalOpts.redisHost,
      port: globalOpts.redisPort,
      db: globalOpts.stateDb || 0,
    });

    try {
      await initState(
        client,
        globalOpts.stateKey,
        options.executionMode,
        globalOpts.sandboxRoot
      );
    } finally {
      await client.quit();
    }
  });

// Command: set-goal
program
  .command('set-goal')
  .description('Set supervisor goal')
  .requiredOption('--description <text>', 'Goal description')
  .requiredOption('--project-id <id>', 'Project ID (required)')
  .action(async (options) => {
    const globalOpts = program.opts();
    const client = new Redis({
      host: globalOpts.redisHost,
      port: globalOpts.redisPort,
      db: globalOpts.stateDb || 0,
    });

    try {
      await setGoal(
        client,
        globalOpts.stateKey,
        options.description,
        options.projectId
      );
    } finally {
      await client.quit();
    }
  });

// Command: enqueue
program
  .command('enqueue')
  .description('Enqueue a task')
  .requiredOption('--task-file <path>', 'Path to task JSON file')
  .action(async (options) => {
    const globalOpts = program.opts();
    const client = new Redis({
      host: globalOpts.redisHost,
      port: globalOpts.redisPort,
      db: globalOpts.stateDb || 0,
    });

    try {
      await enqueue(
        client,
        globalOpts.queueName,
        globalOpts.queueDb,
        options.taskFile
      );
    } finally {
      await client.quit();
    }
  });

// Command: halt
program
  .command('halt')
  .description('Halt supervisor')
  .option('--reason <text>', 'Halt reason')
  .action(async (options) => {
    const globalOpts = program.opts();
    const client = new Redis({
      host: globalOpts.redisHost,
      port: globalOpts.redisPort,
      db: globalOpts.stateDb || 0,
    });

    try {
      await halt(
        client,
        globalOpts.stateKey,
        options.reason
      );
    } finally {
      await client.quit();
    }
  });

// Command: status
program
  .command('status')
  .description('Check supervisor status and display current state information')
  .action(async () => {
    const globalOpts = program.opts();
    const client = new Redis({
      host: globalOpts.redisHost,
      port: globalOpts.redisPort,
      db: globalOpts.stateDb || 0,
    });

    try {
      await status(client, globalOpts.stateKey);
    } finally {
      await client.quit();
    }
  });

// Command: metrics
program
  .command('metrics')
  .description('Display aggregated performance metrics')
  .action(async () => {
    const globalOpts = program.opts();
    const client = new Redis({
      host: globalOpts.redisHost,
      port: globalOpts.redisPort,
      db: globalOpts.stateDb || 0,
    });

    try {
      await showMetrics(client, globalOpts.stateKey, globalOpts.sandboxRoot);
    } finally {
      await client.quit();
    }
  });

// Command: resume
program
  .command('resume')
  .description('Resume supervisor (sets status to RUNNING, use start to actually run)')
  .action(async () => {
    const globalOpts = program.opts();
    const client = new Redis({
      host: globalOpts.redisHost,
      port: globalOpts.redisPort,
      db: globalOpts.stateDb || 0,
    });

    try {
      await resume(client, globalOpts.stateKey);
    } finally {
      await client.quit();
    }
  });

// Command: start
program
  .command('start')
  .description('Start supervisor control loop (runs until halted or completed)')
  .action(async () => {
    const globalOpts = program.opts();
    
    try {
      await start(
        globalOpts.redisHost,
        globalOpts.redisPort,
        globalOpts.stateKey,
        globalOpts.stateDb || 0,
        globalOpts.queueName,
        globalOpts.queueDb,
        globalOpts.sandboxRoot || './sandbox'
      );
    } catch (error) {
      console.error('Failed to start supervisor:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Parse arguments and execute
// Only parse if this file is being run directly (not imported)
if (process.argv[1] && (process.argv[1].endsWith('cli.ts') || process.argv[1].endsWith('cli.js'))) {
  program.parse();
}

export { initState, setGoal, enqueue, halt, resume, start, status };

