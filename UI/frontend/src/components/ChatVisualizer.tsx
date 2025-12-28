// ChatVisualizer Component
// Visualizes supervisor-agent conversation as a chat interface
import React, { useMemo, useState } from 'react';

interface ChatMessage {
  id: string;
  timestamp: string;
  type: 'supervisor' | 'agent';
  content: string;
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

  // Transform logs into chat messages
  const messages = useMemo(() => {
    const chatMessages: ChatMessage[] = [];
    
    logs.forEach((log, index) => {
      const type = log.type || '';
      const content = log.content || '';
      const timestamp = log.timestamp || '';
      const taskId = log.task_id || '';
      const iteration = log.iteration || 0;
      const metadata = log.metadata || {};
      
      // Determine if this is a supervisor message (prompt) or agent message (response)
      let messageType: 'supervisor' | 'agent';
      if (type.includes('PROMPT')) {
        messageType = 'supervisor';
      } else if (type.includes('RESPONSE')) {
        messageType = 'agent';
      } else {
        // Default: prompts are supervisor, responses are agent
        messageType = type === 'PROMPT' || type === 'INTERROGATION_PROMPT' || type === 'FIX_PROMPT' || type === 'CLARIFICATION_PROMPT'
          ? 'supervisor'
          : 'agent';
      }
      
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
        metadata,
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
            const isInterrogationMsg = isInterrogation(message.messageType);
            return (
              <div
                key={message.id}
                className={`flex ${message.type === 'supervisor' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-3xl rounded-lg p-4 shadow-sm ${
                    isInterrogationMsg
                      ? message.type === 'supervisor'
                        ? 'bg-purple-50 border-2 border-purple-400 ring-2 ring-purple-200'
                        : 'bg-amber-50 border-2 border-amber-400 ring-2 ring-amber-200'
                      : message.type === 'supervisor'
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-green-50 border border-green-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
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
                    {isInterrogationMsg && message.questionNumber && (
                      <span className="px-2 py-0.5 bg-purple-200 text-purple-800 text-xs font-bold rounded">
                        Interrogation #{message.questionNumber}
                      </span>
                    )}
                    {isInterrogationMsg && message.criterion && (
                      <span className="text-xs text-gray-600 italic">
                        ({message.criterion})
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatMessageType(message.messageType)}
                    </span>
                    {message.taskId && (
                      <span className="text-xs text-gray-500">
                        • Task: {message.taskId}
                      </span>
                    )}
                    {message.iteration > 0 && (
                      <span className="text-xs text-gray-500">
                        • Iteration: {message.iteration}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {formatTimestamp(message.timestamp)}
                  </div>
                  {message.metadata && Object.keys(message.metadata).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                        Metadata
                      </summary>
                      <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto">
                        {JSON.stringify(message.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

