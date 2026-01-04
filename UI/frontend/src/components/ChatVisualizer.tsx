// ChatVisualizer Component
// Visualizes supervisor-agent conversation as a chat interface
import { useMemo, useState } from 'react';
import Markdown from 'react-markdown';

interface ChatMessage {
  id: string;
  timestamp: string;
  type: 'supervisor' | 'agent';
  content: React.ReactNode;
  taskId: string;
  iteration: number;
  messageType: string; // PROMPT, RESPONSE, INTERROGATION_PROMPT, etc.
  metadata?: Record<string, unknown>;
  questionNumber?: number; // For interrogation messages
  criterion?: string; // For interrogation messages
}

interface ChatVisualizerProps {
  logs: Array<Record<string, any>>;
  className?: string;
}

export default function ChatVisualizer({ logs, className = '' }: ChatVisualizerProps) {
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('newest');
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());

  const toggleDetails = (messageId: string) => {
    const newExpanded = new Set(expandedDetails);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedDetails(newExpanded);
  };

  // Helper to detect if content is JSON
  const isJSON = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  // Helper to normalize newlines (reduce consecutive newlines by one)
  const normalizeNewlines = (str: string): string => {
    return str.replace(/\n{2,}/g, '\n');
  };

  // Helper to render content based on type
  const renderContent = (rawContent: string): React.ReactNode => {
    const normalized = normalizeNewlines(rawContent);
    if (isJSON(normalized)) {
      return (
        <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-96 text-gray-800">
          {JSON.stringify(JSON.parse(normalized), null, 2)}
        </pre>
      );
    }
    return (
      <Markdown
        components={{
          h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-2 mt-4" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-2 mt-3" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-lg font-bold mb-1 mt-2" {...props} />,
          h4: ({node, ...props}) => <h4 className="text-base font-bold mb-1 mt-2" {...props} />,
          h5: ({node, ...props}) => <h5 className="text-sm font-bold mb-1 mt-1" {...props} />,
          h6: ({node, ...props}) => <h6 className="text-xs font-bold mb-1 mt-1" {...props} />,
        }}
      >
        {normalized}
      </Markdown>
    );
  };

  // Transform logs into chat messages
  const messages = useMemo(() => {
    const chatMessages: ChatMessage[] = [];
    
    logs.forEach((log, index) => {
      const type = log.type || '';
      const rawContent = log.content || '';
      const timestamp = log.timestamp || '';
      const taskId = log.task_id || '';
      const iteration = log.iteration || 0;
      const metadata = log.metadata || {};
      
      // Determine if this is a supervisor message (prompt) or agent message (response)
      let messageType: 'supervisor' | 'agent';
      
      const supervisorTypes = [
        'PROMPT',
        'INTERROGATION_PROMPT',
        'FIX_PROMPT',
        'CLARIFICATION_PROMPT',
        'HELPER_AGENT_PROMPT',
        'GOAL_COMPLETION_CHECK'
      ];
      
      const agentTypes = [
        'RESPONSE',
        'INTERROGATION_RESPONSE',
        'HELPER_AGENT_RESPONSE',
        'GOAL_COMPLETION_RESPONSE'
      ];

      if (supervisorTypes.includes(type)) {
        messageType = 'supervisor';
      } else if (agentTypes.includes(type)) {
        messageType = 'agent';
      } else if (type.includes('PROMPT') || type.includes('CHECK')) {
        messageType = 'supervisor';
      } else {
        messageType = 'agent';
      }
      
      // Always show full content - no truncation
      const content = renderContent(rawContent);
      const hasMore = false;
      
      // Extract interrogation details
      const questionNumber = metadata.question_number as number | undefined;
      const criterion = metadata.criterion as string | undefined;
      
      chatMessages.push({
        id: `${taskId}-${iteration}-${type}-${index}`,
        timestamp,
        type: messageType,
        content,
        taskId,
        iteration,
        messageType: type,
        metadata: {
          ...metadata,
          rawContent: rawContent,
          hasMore: hasMore,
        },
        questionNumber,
        criterion,
      });
    });
    
    // Sort by timestamp
    const sorted = chatMessages.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Reverse if newest first
    return sortOrder === 'newest' ? sorted.reverse() : sorted;
  }, [logs, sortOrder]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatMessageType = (type: string) => {
    const typeMap: Record<string, string> = {
      'PROMPT': 'Task Prompt',
      'RESPONSE': 'Task Response',
      'INTERROGATION_PROMPT': 'Interrogation',
      'INTERROGATION_RESPONSE': 'Interrogation Response',
      'FIX_PROMPT': 'Fix Request',
      'CLARIFICATION_PROMPT': 'Clarification Request',
      'HELPER_AGENT_PROMPT': 'Helper Agent Request',
      'HELPER_AGENT_RESPONSE': 'Helper Agent Response',
      'GOAL_COMPLETION_CHECK': 'Goal Check',
      'GOAL_COMPLETION_RESPONSE': 'Goal Check Response',
    };
    return typeMap[type] || type;
  };

  const isInterrogation = (messageType: string) => {
    return messageType.includes('INTERROGATION');
  };

  return (
    <div className={`${className} bg-gray-50 rounded-lg p-4`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Conversation</h3>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Sort:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'oldest' | 'newest')}
            className="px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="oldest">Oldest First</option>
            <option value="newest">Newest First</option>
          </select>
        </div>
      </div>
      <div className="space-y-4 max-h-[80vh] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No conversation logs available
          </div>
        ) : (
          messages.map((message) => {
            const isExpanded = expandedDetails.has(message.id);
            const isInterrogationMsg = message.messageType?.includes('INTERROGATION');
            const hasMetadata = message.metadata && Object.keys(message.metadata).length > 0;
            const rawContent = message.metadata?.rawContent as string || '';
            const hasMore = message.metadata?.hasMore as boolean || false;
            
            return (
              <div
                key={message.id}
                className={`flex ${message.type === 'supervisor' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-3xl rounded-lg shadow-sm overflow-hidden ${
                    isInterrogationMsg
                      ? message.type === 'supervisor'
                        ? 'bg-purple-50 border-2 border-purple-400'
                        : 'bg-amber-50 border-2 border-amber-400'
                      : message.type === 'supervisor'
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-green-50 border border-green-200'
                  }`}
                >
                  {/* Minimal header */}
                  <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isInterrogationMsg
                          ? message.type === 'supervisor'
                            ? 'bg-purple-500'
                            : 'bg-amber-500'
                          : message.type === 'supervisor'
                          ? 'bg-blue-500'
                          : 'bg-green-500'
                      }`}
                    />
                    <span className="text-xs font-semibold text-gray-700">
                      {message.type === 'supervisor' ? 'Supervisor' : 'Agent'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(message.timestamp)}
                    </span>
                    {isInterrogationMsg && message.questionNumber && (
                      <span className="px-2 py-0.5 bg-purple-200 text-purple-800 text-xs font-bold rounded">
                        Interrogation #{message.questionNumber}
                      </span>
                    )}
                    {hasMore && (
                      <span className="text-xs text-gray-500 italic">
                        (truncated)
                      </span>
                    )}
                  </div>
                  
                  {/* Main content - preview or full if short */}
                  <div className="px-4 pb-3 text-sm text-gray-800 whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                  
                  {/* Expandable details strip */}
                  <div className="border-t border-gray-200 bg-gray-50 bg-opacity-50">
                    <button
                      onClick={() => toggleDetails(message.id)}
                      className="w-full px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-between"
                    >
                      <span className="font-medium">⋯ Details</span>
                      <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                    </button>
                    
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-3 text-xs text-gray-700">
                        {/* Full Content section if truncated */}
                        {hasMore && (
                          <div>
                            <div className="font-medium text-gray-500 mb-2">Full Response:</div>
                            <div className="bg-white border border-gray-200 rounded p-3 max-h-96 overflow-auto">
                              <div className="text-sm prose prose-sm max-w-none">
                                {renderContent(rawContent)}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-500">Type:</span>
                          <span>{formatMessageType(message.messageType)}</span>
                        </div>
                        
                        {message.taskId && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-500">Task:</span>
                            <span className="font-mono">{message.taskId}</span>
                          </div>
                        )}
                        
                        {message.iteration > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-500">Iteration:</span>
                            <span>{message.iteration}</span>
                          </div>
                        )}
                        
                        {isInterrogationMsg && message.criterion && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-500">Criterion:</span>
                            <span className="italic">{message.criterion}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-500">Time:</span>
                          <span>{formatTimestamp(message.timestamp)}</span>
                        </div>
                        
                        {hasMetadata && message.metadata && (
                          <div className="mt-2">
                            <div className="font-medium text-gray-500 mb-1">Metadata:</div>
                            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(
                                Object.fromEntries(
                                  Object.entries(message.metadata).filter(([key]) => 
                                    key !== 'rawContent' && key !== 'hasMore'
                                  )
                                ),
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

