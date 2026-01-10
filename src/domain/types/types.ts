// Type definitions for supervisor state and related structures

import { Provider } from "../agents/enums/provider";

export type SupervisorStatus = 'RUNNING' | 'BLOCKED' | 'HALTED' | 'COMPLETED';
export type TaskType = 
  | 'coding'           // Standard file modification
  | 'behavioral'       // Conversational / Greeting (Response-centric)
  | 'verification'     // Code analysis / auditing (Findings-centric)
  | 'research'         // External info / library selection (Knowledge-centric)
  | 'testing'          // Running tests (Results-centric)
  | 'orchestration'    // Delegating to other agents
  // Legacy types mapped to 'coding' logic
  | 'configuration' 
  | 'documentation' 
  | 'implementation' 
  | 'refactoring';

export interface BehavioralOutput {
  status: 'completed' | 'failed';
  response: string;
  confidence: number;
  reasoning: string;
}

export interface VerificationOutput {
  status: 'completed' | 'failed';
  findings: string[];
  verdict: 'pass' | 'fail';
  reasoning: string;
}

export interface CodingOutput {
  status: 'completed' | 'failed';
  files_created: string[];
  files_updated: string[];
  changes: string[];
  neededChanges: boolean;
  reasoning: string;
  summary: string;
}

export interface SupervisorState {
  supervisor: {
    status: SupervisorStatus;
    iteration?: number;
    last_task_id?: string;
    last_validation_report?: ValidationReport;
    halt_reason?: string;
    halt_details?: string;
    resource_exhausted_retry?: {
      attempt: number;
      last_attempt_at: string;
      next_retry_at: string;
    };
  };
  goal: {
    description: string;
    completed: boolean;
    project_id?: string;
  };
  constraints?: Record<string, unknown>;
  current_task?: Task;
  completed_tasks?: CompletedTask[];
  blocked_tasks?: BlockedTask[];
  decisions?: Decision[];
  artifacts?: Artifact[];
  active_sessions?: Record<string, SessionInfo>; // Keyed by feature_id or project_id
  queue: {
    exhausted: boolean;
  };
  last_updated: string;
  execution_mode: 'AUTO' | 'MANUAL';
}

export interface SessionInfo {
  session_id: string;
  provider: string;
  last_used: string; // ISO timestamp
  error_count: number;
  total_tokens?: number;
  feature_id?: string;
  task_id?: string;
}

export interface Task {
  task_id: string;
  intent: string;
  tool: Provider;
  task_type?: TaskType; // Defaults to 'coding' if not specified
  instructions: string;
  acceptance_criteria: string[];
  retry_policy?: RetryPolicy;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed';
  // Validation-specific fields
  expected_json_schema?: Record<string, unknown>; // Expected JSON schema for output
  required_artifacts?: string[]; // Relative paths to required artifacts
  test_command?: string; // Command to run tests
  tests_required?: boolean; // Whether tests must pass
  // Working directory override (optional)
  working_directory?: string; // Relative path from sandboxRoot, overrides project_id-based default
  // Agent mode override (optional)
  agent_mode?: string; // Agent mode to use (e.g., 'auto', 'opus'), defaults to 'auto'
  // Metadata for session tracking and grouping
  meta?: {
    session_id?: string;
    feature_id?: string;
    [key: string]: any;
  };
}

export interface RetryPolicy {
  max_retries?: number;
  backoff?: string;
}

export interface CompletedTask {
  task_id: string;
  completed_at: string;
  validation_report: ValidationReport;
}

export interface BlockedTask {
  task_id: string;
  blocked_at: string;
  reason: string;
}

export interface Decision {
  decision_id: string;
  made_at: string;
  context: string;
  outcome: string;
}

export interface Artifact {
  artifact_id: string;
  created_at: string;
  path: string;
  type: string;
}

export interface ValidationReport {
  valid: boolean;
  reason?: string; // On failure
  rules_passed: string[];
  rules_failed: string[];
  checks?: ValidationCheck[]; // Legacy support
  confidence?: 'HIGH' | 'LOW' | 'UNCERTAIN'; // Confidence level in validation result
  failed_criteria?: string[]; // Specific criteria that failed (for interrogation)
  uncertain_criteria?: string[]; // Criteria that couldn't be validated (design/planning tasks)
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  details?: string;
}

// Interrogation types
export interface InterrogationResult {
  criterion: string;
  question: string;
  agent_response: string;
  analysis_result: 'COMPLETE' | 'INCOMPLETE' | 'UNCERTAIN';
  analysis_reason: string;
  file_paths_found?: string[];
  question_number: number;
}

export interface InterrogationSession {
  task_id: string;
  failed_criteria: string[];
  interrogation_results: InterrogationResult[];
  all_criteria_satisfied: boolean;
  remaining_failed_criteria: string[];
}

// Command generation types
export interface CommandGenerationResult {
  isValid: boolean; // If true, interrogation not required
  verificationCommands: string[]; // Commands to execute if not valid
  reasoning?: string; // Optional explanation
  sessionId?: string; // Session ID of the helper agent
  usage?: { tokens?: number }; // Token usage of the helper agent
}

export interface CommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  passed: boolean;
}

export interface CommandExecutionResult {
  passed: boolean;
  results: CommandResult[];
}

export interface TaskMetrics {
  task_id: string;
  start_time: string;
  end_time?: string;
  total_duration_ms?: number;
  iterations: number;
  status: 'COMPLETED' | 'FAILED' | 'BLOCKED';
  
  // Phase timing
  time_in_execution_ms: number;
  time_in_validation_ms: number;
  time_in_interrogation_ms: number;
  
  // Counts
  interrogation_rounds: number;
  helper_agent_calls: number;
  failed_validations: number;
  deterministic_attempts?: number;
  deterministic_success?: number;
  helper_duration_ms_total?: number;
  helper_avg_ms?: number;
  helper_p95_ms?: number;
  cache_hit_rate?: number;
  
  // Cost (Token proxy)
  total_prompt_chars: number;
  total_response_chars: number;
}

