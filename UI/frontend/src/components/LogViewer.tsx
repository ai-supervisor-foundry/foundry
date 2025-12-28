// LogViewer Component
// JSONL log entry display with syntax highlighting and expandable content
import React, { useState } from 'react';

interface LogViewerProps {
  logs: Array<Record<string, any>>;
  className?: string;
}

export default function LogViewer({ logs, className = '' }: LogViewerProps) {
  const [selectedLog, setSelectedLog] = useState<Record<string, any> | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  const toggleExpand = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLogs(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getContentPreview = (log: Record<string, any>): string => {
    // For prompt logs, show content preview
    if (log.content && typeof log.content === 'string') {
      return log.content.length > 200 ? log.content.substring(0, 200) + '...' : log.content;
    }
    // For audit logs, show a summary
    if (log.validation_summary) {
      return `Validation: ${log.validation_summary.valid ? 'PASSED' : 'FAILED'}`;
    }
    return '';
  };

  return (
    <div className={className}>
      <div className="space-y-2">
        {logs.map((log, index) => {
          const isExpanded = expandedLogs.has(index);
          const hasContent = log.content && typeof log.content === 'string';
          // Audit logs have expandable details
          const hasExpandableDetails = log.validation_summary || log.state_diff || log.prompt_preview || log.response_preview || log.halt_reason;
          const canExpand = hasContent || hasExpandableDetails;
          
          return (
            <div
              key={index}
              className="border rounded p-3 hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-mono text-sm">
                    <span className="text-gray-500">[{log.timestamp || 'N/A'}]</span>
                    {log.task_id && (
                      <span className="ml-2 text-blue-600">Task: {log.task_id}</span>
                    )}
                    {log.event && (
                      <span className="ml-2 text-purple-600">Event: {log.event}</span>
                    )}
                  </div>
                  {log.type && (
                    <div className="mt-1 text-xs text-gray-600">Type: {log.type}</div>
                  )}
                  {log.validation_summary && (
                    <div className="mt-1 text-xs">
                      <span className={`font-semibold ${log.validation_summary.valid ? 'text-green-600' : 'text-red-600'}`}>
                        Validation: {log.validation_summary.valid ? 'PASSED' : 'FAILED'}
                      </span>
                      {log.validation_summary.rules_failed && log.validation_summary.rules_failed.length > 0 && (
                        <span className="ml-2 text-red-600">
                          ({log.validation_summary.rules_failed.length} failed)
                        </span>
                      )}
                    </div>
                  )}
                  {hasContent && (
                    <div className="mt-2 text-xs text-gray-500">
                      Content length: {log.content.length} characters
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {canExpand && (
                    <button
                      onClick={(e) => toggleExpand(index, e)}
                      className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium text-sm flex items-center gap-1.5 shadow-sm"
                    >
                      {isExpanded ? (
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(hasContent ? log.content : JSON.stringify(log, null, 2));
                    }}
                    className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    Copy
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLog(log);
                    }}
                    className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    View JSON
                  </button>
                </div>
              </div>
              
              {isExpanded && hasContent && (
                <div className="mt-4 pt-4 border-t">
                  <div className="bg-gray-50 rounded p-4 max-h-96 overflow-auto">
                    <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 break-words">
                      {log.content}
                    </pre>
                  </div>
                </div>
              )}
              
              {isExpanded && hasExpandableDetails && !hasContent && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  {log.validation_summary && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Validation Summary</h4>
                      <div className="bg-gray-50 rounded p-3">
                        <div className="text-sm">
                          <div className="mb-2">
                            <span className={`font-semibold ${log.validation_summary.valid ? 'text-green-600' : 'text-red-600'}`}>
                              Status: {log.validation_summary.valid ? 'PASSED' : 'FAILED'}
                            </span>
                          </div>
                          {log.validation_summary.reason && (
                            <div className="mb-2 text-gray-700">
                              <span className="font-medium">Reason:</span> {log.validation_summary.reason}
                            </div>
                          )}
                          {log.validation_summary.rules_passed && log.validation_summary.rules_passed.length > 0 && (
                            <div className="mb-2">
                              <span className="font-medium text-green-600">Passed:</span>
                              <ul className="list-disc list-inside ml-2 text-xs">
                                {log.validation_summary.rules_passed.map((rule: string, i: number) => (
                                  <li key={i} className="text-gray-700">{rule}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {log.validation_summary.rules_failed && log.validation_summary.rules_failed.length > 0 && (
                            <div className="mb-2">
                              <span className="font-medium text-red-600">Failed:</span>
                              <ul className="list-disc list-inside ml-2 text-xs">
                                {log.validation_summary.rules_failed.map((rule: string, i: number) => (
                                  <li key={i} className="text-gray-700">{rule}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {log.state_diff && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">State Diff</h4>
                      <div className="bg-gray-50 rounded p-3 max-h-48 overflow-auto">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <div className="font-semibold text-red-600 mb-1">Before</div>
                            <pre className="whitespace-pre-wrap text-gray-700">
                              {JSON.stringify(log.state_diff.before, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <div className="font-semibold text-green-600 mb-1">After</div>
                            <pre className="whitespace-pre-wrap text-gray-700">
                              {JSON.stringify(log.state_diff.after, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {log.prompt_preview && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Prompt Preview</h4>
                      <div className="bg-gray-50 rounded p-3 max-h-48 overflow-auto">
                        <pre className="whitespace-pre-wrap font-mono text-xs text-gray-800 break-words">
                          {log.prompt_preview}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {log.response_preview && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Response Preview</h4>
                      <div className="bg-gray-50 rounded p-3 max-h-48 overflow-auto">
                        <pre className="whitespace-pre-wrap font-mono text-xs text-gray-800 break-words">
                          {log.response_preview}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {log.halt_reason && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2 text-red-600">Halt Reason</h4>
                      <div className="bg-red-50 rounded p-3">
                        <div className="text-sm text-red-800">{log.halt_reason}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {!isExpanded && hasContent && (
                <div className="mt-2 pt-2 border-t">
                  <div className="text-xs text-gray-500 italic">
                    {getContentPreview(log)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedLog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Log Details (Full JSON)</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(selectedLog, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

