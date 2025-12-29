// Operator CLI Entrypoint
// Operator is the only authority
// Supervisor never self-recovers

import { Command } from 'commander';
import Redis from 'ioredis';
import { loadState, persistState, PersistenceLayer } from './persistence';
import { enqueueTask, getQueueKey, QueueAdapter, createQueue } from './queue';
import { SupervisorState, Task } from './types';
import { controlLoop } from './controlLoop';
import { PromptBuilder } from './promptBuilder';
import { CLIAdapter } from './cliAdapter';
import { Validator } from './validator';
import { AuditLogger } from './auditLogger';
import { logVerbose as logVerboseShared, logPerformance as logPerformanceShared } from './logger';
import * as fs from 'fs/promises';
import * as path from 'path';

function logVerbose(component: string, message: string, data?: Record<string, unknown>): void {
  logVerboseShared(`CLI:${component}`, message, data);
}

function logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
  logPerformanceShared(`[CLI] ${operation}`, duration, metadata);
}

const program = new Command();

// Global options
program
  .requiredOption('--redis-host <host>', 'DragonflyDB host')
  .requiredOption('--redis-port <port>', 'DragonflyDB port')
  .requiredOption('--state-key <key>', 'Supervisor state key (operator-defined, fixed)')
  .requiredOption('--queue-name <name>', 'Task queue name')
  .requiredOption('--queue-db <index>', 'Queue database index (must differ from state DB)', (value: string) => parseInt(value, 10))
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
    goal: {
      description: '', // Must be set via set-goal
      completed: false,
    },
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
  await persistState(client, stateKey, initialState);
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
  projectId?: string
): Promise<void> {
  const startTime = Date.now();
  logVerbose('SetGoal', 'Setting supervisor goal', {
    state_key: stateKey,
    goal_description_length: goalDescription.length,
    has_project_id: !!projectId,
    project_id: projectId,
  });
  
  const loadStartTime = Date.now();
  const state = await loadState(client, stateKey);
  const loadDuration = Date.now() - loadStartTime;
  logPerformance('SetGoalStateLoad', loadDuration, { state_key: stateKey });
  logVerbose('SetGoal', 'State loaded', {
    state_key: stateKey,
    current_status: state.supervisor.status,
    current_goal: state.goal.description,
    current_project_id: state.goal.project_id,
  });
  
  const previousGoal = state.goal.description;
  const previousProjectId = state.goal.project_id;
  state.goal.description = goalDescription;
  if (projectId) {
    state.goal.project_id = projectId;
  }
  logVerbose('SetGoal', 'Goal updated in state', {
    state_key: stateKey,
    previous_goal_length: previousGoal.length,
    new_goal_length: goalDescription.length,
    previous_project_id: previousProjectId,
    new_project_id: projectId || previousProjectId,
  });

  const persistStartTime = Date.now();
  await persistState(client, stateKey, state);
  const persistDuration = Date.now() - persistStartTime;
  logPerformance('SetGoalStatePersist', persistDuration, { state_key: stateKey });
  
  const totalDuration = Date.now() - startTime;
  logPerformance('SetGoal', totalDuration, { state_key: stateKey });
  console.log('Goal set successfully');
  logVerbose('SetGoal', 'Goal set completed', {
    state_key: stateKey,
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
    if (!task.task_id || !task.instructions || !task.acceptance_criteria) {
      logVerbose('Enqueue', 'Task validation failed', {
        task_id: task.task_id || 'unknown',
        has_task_id: !!task.task_id,
        has_instructions: !!task.instructions,
        has_acceptance_criteria: !!task.acceptance_criteria,
      });
      throw new Error(`Task ${task.task_id || 'unknown'} must have task_id, instructions, and acceptance_criteria`);
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

  const queueKey = getQueueKey(queueName);
  logVerbose('Enqueue', 'Queue key determined', { queue_key: queueKey });
  
  // Enqueue all tasks
  const enqueueStartTime = Date.now();
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskEnqueueStartTime = Date.now();
    logVerbose('Enqueue', 'Enqueuing individual task', {
      task_index: i + 1,
      total_tasks: tasks.length,
      task_id: task.task_id,
      intent: task.intent,
    });
    await enqueueTask(queueClient, queueKey, task);
    const taskEnqueueDuration = Date.now() - taskEnqueueStartTime;
    logPerformance('IndividualTaskEnqueue', taskEnqueueDuration, {
      task_id: task.task_id,
      task_index: i + 1,
    });
    console.log(`Task ${task.task_id} enqueued successfully`);
  }
  const enqueueDuration = Date.now() - enqueueStartTime;
  logPerformance('AllTasksEnqueue', enqueueDuration, { task_count: tasks.length });
  
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
    
    // Display goal information
    console.log('\n=== Goal ===');
    console.log(`Description: ${state.goal.description || '(not set)'}`);
    console.log(`Completed: ${state.goal.completed ? 'Yes' : 'No'}`);
    if (state.goal.project_id) {
      console.log(`Project ID: ${state.goal.project_id}`);
    }
    
    // Display queue information
    console.log('\n=== Queue ===');
    console.log(`Exhausted: ${state.queue.exhausted ? 'Yes' : 'No'}`);
    
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
  logVerbose('Resume', 'State loaded', {
    state_key: stateKey,
    current_status: state.supervisor.status,
    current_halt_reason: state.supervisor.halt_reason,
    has_goal: !!state.goal.description,
    goal_length: state.goal.description?.length || 0,
  });
  
  // Validate that goal is set
  if (!state.goal.description) {
    logVerbose('Resume', 'Resume failed: goal not set', {
      state_key: stateKey,
      has_goal: false,
    });
    throw new Error('Cannot resume: goal not set. Use set-goal command first.');
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
    const state = await loadState(stateClient, stateKey);
    const stateLoadDuration = Date.now() - stateLoadStartTime;
    logPerformance('StartStateLoad', stateLoadDuration, { state_key: stateKey });
    logVerbose('Start', 'State loaded', {
      state_key: stateKey,
      status: state.supervisor.status,
      iteration: state.supervisor.iteration,
      execution_mode: state.execution_mode,
      has_goal: !!state.goal.description,
      goal_length: state.goal.description?.length || 0,
      project_id: state.goal.project_id,
    });
    
    // Validate that goal is set
    if (!state.goal.description) {
      logVerbose('Start', 'Start failed: goal not set', {
        state_key: stateKey,
        has_goal: false,
      });
      throw new Error('Cannot start: goal not set. Use set-goal command first.');
    }

    // Initialize all dependencies
    const dependencyInitStartTime = Date.now();
    const persistence = new PersistenceLayer(stateClient, stateKey);
    const queue = new QueueAdapter(queueClient, queueName);
    const promptBuilder = new PromptBuilder();
    // Initialize CLIAdapter with Redis client for circuit breaker
    // Use stateClient for circuit breaker storage (same DB as state)
    const ttlSeconds = parseInt(process.env.CIRCUIT_BREAKER_TTL_SECONDS || '86400', 10);
    const cliAdapter = new CLIAdapter(stateClient, undefined, ttlSeconds);
    const validator = new Validator();
    const dependencyInitDuration = Date.now() - dependencyInitStartTime;
    logPerformance('DependencyInitialization', dependencyInitDuration, {});
    logVerbose('Start', 'Dependencies initialized', {
      cursor_cli_path: process.env.CURSOR_CLI_PATH || 'cursor',
      circuit_breaker_ttl_seconds: ttlSeconds,
    });
    
    // Determine audit log path from state
    const projectId = state.goal.project_id || 'default';
    const logDir = path.join(sandboxRoot, projectId);
    const logPath = path.join(logDir, 'audit.log.jsonl');
    const auditLogger = new AuditLogger(logPath);
    logVerbose('Start', 'Audit logger initialized', {
      project_id: projectId,
      log_dir: logDir,
      log_path: logPath,
    });

    const promptsLogPath = path.join(logDir, 'logs', 'prompts.log.jsonl');
    console.log('Starting supervisor control loop...');
    console.log(`State key: ${stateKey}`);
    console.log(`Queue: ${queueName}`);
    console.log(`Sandbox root: ${sandboxRoot}`);
    console.log(`Project ID: ${projectId}`);
    console.log(`Audit log: ${logPath}`);
    console.log(`Prompts log: ${promptsLogPath}`);
    console.log('Press Ctrl+C to stop\n');
    logVerbose('Start', 'Control loop starting', {
      state_key: stateKey,
      queue_name: queueName,
      sandbox_root: sandboxRoot,
      project_id: projectId,
      audit_log_path: logPath,
      prompts_log_path: promptsLogPath,
    });

    // Run control loop (runs until halted or completed)
    const controlLoopStartTime = Date.now();
    await controlLoop(
      persistence,
      queue,
      promptBuilder,
      cliAdapter,
      validator,
      auditLogger,
      sandboxRoot
    );
    const controlLoopDuration = Date.now() - controlLoopStartTime;
    logPerformance('ControlLoop', controlLoopDuration, {});
    logVerbose('Start', 'Control loop completed', {
      total_duration_ms: controlLoopDuration,
    });
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
  .requiredOption('--execution-mode <mode>', 'Execution mode: AUTO or MANUAL')
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
  .option('--project-id <id>', 'Project ID')
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

