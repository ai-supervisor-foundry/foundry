// TaskCard Component
// Display task information with status badge and expandable details
import { useState } from 'react';
import StatusBadge from './StatusBadge';

interface TaskCardProps {
  task: {
    task_id: string;
    intent?: string;
    status?: string;
    instructions?: string;
    acceptance_criteria?: string[];
    retry_policy?: any;
    working_directory?: string;
    agent_mode?: string;
    required_artifacts?: string[];
    test_command?: string;
    // Completed task fields
    completed_at?: string;
    validation_report?: {
      valid: boolean;
      reason?: string;
      rules_passed?: string[];
      rules_failed?: string[];
      confidence?: 'HIGH' | 'LOW' | 'UNCERTAIN';
      failed_criteria?: string[];
      uncertain_criteria?: string[];
    };
    // Blocked task fields
    blocked_at?: string;
    reason?: string;
    [key: string]: any;
  };
  className?: string;
  isCurrent?: boolean;
  onEdit?: (task: any) => void;
}

export default function TaskCard({ task, className = '', isCurrent = false, onEdit }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasDetails = task.instructions || 
    (task.acceptance_criteria && task.acceptance_criteria.length > 0) ||
    task.retry_policy ||
    task.working_directory ||
    task.agent_mode ||
    task.required_artifacts ||
    task.test_command ||
    task.validation_report ||
    task.reason;
  
  const isCompleted = !!task.completed_at;
  const isBlocked = !!task.blocked_at;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className={`border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow ${
      isCurrent ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' :
      isCompleted ? 'border-green-200 bg-green-50' : 
      isBlocked ? 'border-red-200 bg-red-50' : 
      ''
    } ${className}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {isCurrent && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                <span>WORKING</span>
              </div>
            )}
            <h3 className="font-semibold text-lg">{task.task_id}</h3>
            {task.status && (
              <StatusBadge status={task.status as any} size="sm" />
            )}
            {isCompleted && (
              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded">
                ✓ Completed
              </span>
            )}
            {isBlocked && (
              <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded">
                ⚠ Blocked
              </span>
            )}
          </div>
          
          {isCompleted && task.completed_at && (
            <div className="mb-2 text-xs text-gray-600">
              <span className="font-medium">Completed:</span> {formatDate(task.completed_at)}
            </div>
          )}
          
          {isBlocked && task.blocked_at && (
            <div className="mb-2 text-xs text-gray-600">
              <span className="font-medium">Blocked:</span> {formatDate(task.blocked_at)}
            </div>
          )}
          
          {task.intent && (
            <p className="text-sm text-gray-700 font-medium mb-1">{task.intent}</p>
          )}
          
          {task.validation_report && !expanded && (
            <div className={`mt-2 px-2 py-1 rounded text-xs ${
              task.validation_report.valid 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              <span className="font-medium">
                Validation: {task.validation_report.valid ? 'PASSED' : 'FAILED'}
              </span>
              {task.validation_report.confidence && (
                <span className="ml-2">({task.validation_report.confidence} confidence)</span>
              )}
            </div>
          )}
          
          {task.reason && !expanded && (
            <div className="mt-2 px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
              <span className="font-medium">Reason:</span> {task.reason.length > 100 
                ? task.reason.substring(0, 100) + '...' 
                : task.reason}
            </div>
          )}
          
          {task.instructions && !expanded && (
            <p className="text-xs text-gray-500 line-clamp-2 mt-1">
              {task.instructions.length > 150 
                ? task.instructions.substring(0, 150) + '...' 
                : task.instructions}
            </p>
          )}
          {task.acceptance_criteria && task.acceptance_criteria.length > 0 && !expanded && (
            <div className="mt-2 text-xs text-gray-600">
              <span className="font-medium">{task.acceptance_criteria.length}</span> acceptance criteria
            </div>
          )}
        </div>
        <div className="flex gap-2 ml-4">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium text-sm border shadow-sm"
            >
              Edit
            </button>
          )}
          {hasDetails && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium text-sm flex items-center gap-1.5 shadow-sm"
            >
              {expanded ? (
                <>
                  <span className="text-base">−</span>
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <span className="text-base">+</span>
                  <span>Expand</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-4">
          {isCompleted && task.completed_at && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Completion Details</h4>
              <div className="bg-green-50 rounded p-3">
                <div className="text-sm text-gray-800">
                  <div className="mb-2">
                    <span className="font-medium">Completed At:</span>
                    <span className="ml-2">{formatDate(task.completed_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {isBlocked && task.blocked_at && (
            <div>
              <h4 className="font-semibold text-sm mb-2 text-red-600">Blocking Details</h4>
              <div className="bg-red-50 rounded p-3">
                <div className="text-sm text-gray-800">
                  <div className="mb-2">
                    <span className="font-medium">Blocked At:</span>
                    <span className="ml-2">{formatDate(task.blocked_at)}</span>
                  </div>
                  {task.reason && (
                    <div className="mt-2">
                      <span className="font-medium">Reason:</span>
                      <p className="mt-1 text-gray-700 whitespace-pre-wrap break-words">
                        {task.reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {task.validation_report && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Validation Report</h4>
              <div className={`rounded p-3 ${
                task.validation_report.valid ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className="text-sm">
                  <div className="mb-2">
                    <span className={`font-semibold ${
                      task.validation_report.valid ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Status: {task.validation_report.valid ? 'PASSED' : 'FAILED'}
                    </span>
                    {task.validation_report.confidence && (
                      <span className="ml-2 text-gray-600">
                        (Confidence: {task.validation_report.confidence})
                      </span>
                    )}
                  </div>
                  {task.validation_report.reason && (
                    <div className="mb-2 text-gray-700">
                      <span className="font-medium">Reason:</span>
                      <p className="mt-1">{task.validation_report.reason}</p>
                    </div>
                  )}
                  {task.validation_report.rules_passed && task.validation_report.rules_passed.length > 0 && (
                    <div className="mb-2">
                      <span className="font-medium text-green-600">Passed Rules:</span>
                      <ul className="list-disc list-inside ml-2 text-xs mt-1">
                        {task.validation_report.rules_passed.map((rule: string, i: number) => (
                          <li key={i} className="text-gray-700">{rule}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {task.validation_report.rules_failed && task.validation_report.rules_failed.length > 0 && (
                    <div className="mb-2">
                      <span className="font-medium text-red-600">Failed Rules:</span>
                      <ul className="list-disc list-inside ml-2 text-xs mt-1">
                        {task.validation_report.rules_failed.map((rule: string, i: number) => (
                          <li key={i} className="text-gray-700">{rule}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {task.validation_report.failed_criteria && task.validation_report.failed_criteria.length > 0 && (
                    <div className="mb-2">
                      <span className="font-medium text-red-600">Failed Criteria:</span>
                      <ul className="list-disc list-inside ml-2 text-xs mt-1">
                        {task.validation_report.failed_criteria.map((criterion: string, i: number) => (
                          <li key={i} className="text-gray-700">{criterion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {task.instructions && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Instructions</h4>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                  {task.instructions}
                </p>
              </div>
            </div>
          )}
          
          {task.acceptance_criteria && task.acceptance_criteria.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">
                Acceptance Criteria ({task.acceptance_criteria.length})
              </h4>
              <div className="bg-gray-50 rounded p-3">
                <ul className="space-y-1">
                  {task.acceptance_criteria.map((criterion: string, index: number) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span className="flex-1">{criterion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {(task.working_directory || task.agent_mode || task.required_artifacts || task.test_command) && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Configuration</h4>
              <div className="bg-gray-50 rounded p-3 space-y-2 text-sm">
                {task.working_directory && (
                  <div>
                    <span className="font-medium text-gray-700">Working Directory:</span>
                    <span className="ml-2 text-gray-600 font-mono">{task.working_directory}</span>
                  </div>
                )}
                {task.agent_mode && (
                  <div>
                    <span className="font-medium text-gray-700">Agent Mode:</span>
                    <span className="ml-2 text-gray-600 font-mono">{task.agent_mode}</span>
                  </div>
                )}
                {task.test_command && (
                  <div>
                    <span className="font-medium text-gray-700">Test Command:</span>
                    <span className="ml-2 text-gray-600 font-mono">{task.test_command}</span>
                  </div>
                )}
                {task.required_artifacts && task.required_artifacts.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Required Artifacts:</span>
                    <ul className="ml-4 mt-1 list-disc list-inside">
                      {task.required_artifacts.map((artifact: string, index: number) => (
                        <li key={index} className="text-gray-600 font-mono text-xs">{artifact}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {task.retry_policy && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Retry Policy</h4>
              <div className="bg-gray-50 rounded p-3">
                <div className="text-sm text-gray-700">
                  {task.retry_policy.max_retries !== undefined && (
                    <div>
                      <span className="font-medium">Max Retries:</span>
                      <span className="ml-2">{task.retry_policy.max_retries}</span>
                    </div>
                  )}
                  {task.retry_policy.backoff_strategy && (
                    <div className="mt-1">
                      <span className="font-medium">Backoff Strategy:</span>
                      <span className="ml-2">{task.retry_policy.backoff_strategy}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="pt-2 border-t">
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(task, null, 2));
              }}
              className="text-xs px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded"
            >
              Copy Full JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

