import { PromptLogType as PromptLogTypeEnum } from "../enums/promptType";
import { Provider } from "../agents/enums/provider";

export interface PromptLogEntry {
    timestamp: string; // ISO format
    task_id: string;
    iteration: number;
    type: PromptLogTypeEnum;
    content: string; // Full prompt/response content (may be truncated if >100KB)
    metadata: {
      agent_mode?: string;
      provider?: Provider | null;
      model?: string;
      working_directory?: string;
      prompt_length?: number;
      response_length?: number;
      stdout_length?: number;
      stderr_length?: number;
      exit_code?: number;
      duration_ms?: number;
      intent?: string;
      session_id?: string;
      truncated?: boolean;
      original_length?: number;
      criterion?: string; // For interrogation entries (single criterion)
      criteria?: string[]; // For batched interrogation entries (multiple criteria)
      criteria_count?: number; // For batched interrogation entries
      question_number?: number; // For interrogation entries
      analysis_result?: 'COMPLETE' | 'INCOMPLETE' | 'UNCERTAIN'; // For interrogation responses
      analysis_results?: { [criterion: string]: { result: 'COMPLETE' | 'INCOMPLETE' | 'UNCERTAIN'; reason: string; file_paths?: string[] } }; // For batched interrogation responses
      file_paths_found?: string[]; // For interrogation responses - file paths mentioned by agent
      direct_file_verification?: boolean; // For interrogation responses - whether files were verified directly
      prompt_type?: string; // For fix/clarification prompts: "fix", "clarification", "fix_fallback", "helper_agent_command_generation"
      retry_count?: number; // For fix/clarification prompts
      // Helper Agent command generation metadata
      failed_criteria?: string[]; // For Helper Agent prompts - failed criteria being checked
      failed_criteria_count?: number; // For Helper Agent prompts - count of failed criteria
      helper_agent_is_valid?: boolean; // For Helper Agent responses
      helper_agent_commands_count?: number; // For Helper Agent responses
      helper_agent_commands?: string[]; // For Helper Agent responses
      command_execution_passed?: boolean; // For command execution results
      command_execution_results?: Array<{ command: string; exitCode: number; passed: boolean }>; // For command execution results
    };
  }