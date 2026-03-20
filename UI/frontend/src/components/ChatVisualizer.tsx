// ChatVisualizer Component
// Visualizes supervisor-agent conversation as a chat interface
import { useMemo, useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import { isJSON, normalizeNewlines, getAgentPreview, getSupervisorPreview } from '../utils/chatParsing';

interface ChatMessage {
  id: string;
  timestamp: string;
  type: 'supervisor' | 'agent';
  rawContent: string;
  taskId: string;
  iteration: number;
  messageType: string;
  metadata?: Record<string, unknown>;
  questionNumber?: number;
  criterion?: string;
}

interface ChatVisualizerProps {
  logs: Array<Record<string, any>>;
  className?: string;
}

function renderContent(rawContent: string): React.ReactNode {
  const normalized = normalizeNewlines(rawContent);
  if (isJSON(normalized)) {
    return (
      <pre className="text-xs bg-slate-50 p-3 rounded-lg overflow-auto max-h-96 text-gray-700 border border-gray-100">
        {JSON.stringify(JSON.parse(normalized), null, 2)}
      </pre>
    );
  }
  return (
    <Markdown
      components={{
        h1: ({node, ...props}) => <h1 className="text-xl font-semibold mb-2 mt-4 text-gray-900" {...props} />,
        h2: ({node, ...props}) => <h2 className="text-lg font-semibold mb-2 mt-3 text-gray-900" {...props} />,
        h3: ({node, ...props}) => <h3 className="text-base font-semibold mb-1 mt-2 text-gray-900" {...props} />,
        h4: ({node, ...props}) => <h4 className="text-sm font-semibold mb-1 mt-2 text-gray-800" {...props} />,
        h5: ({node, ...props}) => <h5 className="text-sm font-medium mb-1 mt-1 text-gray-700" {...props} />,
        h6: ({node, ...props}) => <h6 className="text-xs font-medium mb-1 mt-1 text-gray-600" {...props} />,
      }}
    >
      {normalized}
    </Markdown>
  );
}

// --- Detail Modal ---
interface DetailModalProps {
  message: ChatMessage | null;
  onClose: () => void;
  formatMessageType: (t: string) => string;
  formatTimestamp: (t: string) => string;
}

function DetailModal({ message, onClose, formatMessageType, formatTimestamp }: DetailModalProps) {
  useEffect(() => {
    if (!message) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [message, onClose]);

  if (!message) return null;

  const isInterrogationMsg = message.messageType.includes('INTERROGATION');
  const isFixPrompt = message.messageType === 'FIX_PROMPT';
  const isSupervisor = message.type === 'supervisor';

  let accentColor: string, dotColor: string;
  if (isFixPrompt) {
    accentColor = 'text-yellow-700 bg-yellow-50 border-yellow-300';
    dotColor = 'bg-yellow-500';
  } else if (isInterrogationMsg) {
    accentColor = isSupervisor ? 'text-purple-700 bg-purple-50 border-purple-300' : 'text-amber-700 bg-amber-50 border-amber-300';
    dotColor = isSupervisor ? 'bg-purple-500' : 'bg-amber-500';
  } else {
    accentColor = isSupervisor ? 'text-blue-700 bg-blue-50 border-blue-300' : 'text-green-700 bg-green-50 border-green-300';
    dotColor = isSupervisor ? 'bg-blue-500' : 'bg-green-500';
  }

  const metaEntries = message.metadata
    ? Object.entries(message.metadata).filter(([k]) => k !== 'rawContent' && k !== 'hasMore')
    : [];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b rounded-t-2xl ${accentColor}`}>
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
            <span className="font-semibold text-sm">
              {isSupervisor ? 'Supervisor' : 'Agent'}
            </span>
            <span className="text-sm opacity-75">·</span>
            <span className="text-sm font-medium">{formatMessageType(message.messageType)}</span>
            {isInterrogationMsg && message.questionNumber && (
              <span className="px-2 py-0.5 bg-purple-200 text-purple-800 text-xs font-bold rounded">
                Interrogation #{message.questionNumber}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-xl leading-none ml-4"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 text-sm text-gray-800">
          <div className="prose prose-sm max-w-none">
            {renderContent(message.rawContent)}
          </div>
        </div>

        {/* Metadata footer */}
        <div className="border-t px-6 py-3 bg-slate-50 rounded-b-2xl text-xs text-gray-500 flex flex-wrap gap-x-6 gap-y-1">
          <span><span className="font-medium text-gray-600">Time:</span> {formatTimestamp(message.timestamp)}</span>
          {message.taskId && (
            <span><span className="font-medium text-gray-600">Task:</span> <span className="font-mono">{message.taskId}</span></span>
          )}
          {message.iteration > 0 && (
            <span><span className="font-medium text-gray-600">Iteration:</span> {message.iteration}</span>
          )}
          {isInterrogationMsg && message.criterion && (
            <span><span className="font-medium text-gray-600">Criterion:</span> {message.criterion}</span>
          )}
          {metaEntries.length > 0 && (
            <details className="w-full mt-1">
              <summary className="cursor-pointer font-medium text-gray-600">Raw metadata</summary>
              <pre className="mt-1 bg-slate-50 p-2 rounded-lg overflow-auto max-h-32 text-xs border border-gray-100">
                {JSON.stringify(Object.fromEntries(metaEntries), null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main component ---
export default function ChatVisualizer({ logs, className = '' }: ChatVisualizerProps) {
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('newest');
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);

  const formatTimestamp = (timestamp: string) => new Date(timestamp).toLocaleString();

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

  const messages = useMemo(() => {
    const supervisorTypes = [
      'PROMPT', 'INTERROGATION_PROMPT', 'FIX_PROMPT',
      'CLARIFICATION_PROMPT', 'HELPER_AGENT_PROMPT', 'GOAL_COMPLETION_CHECK',
    ];

    const chatMessages: ChatMessage[] = logs.map((log, index) => {
      const type = log.type || '';
      const rawContent = log.content || '';
      const isAgent = !supervisorTypes.includes(type) && !type.includes('PROMPT') && !type.includes('CHECK');
      const messageType: 'supervisor' | 'agent' = isAgent ? 'agent' : 'supervisor';
      const metadata = log.metadata || {};

      return {
        id: `${log.task_id}-${log.iteration}-${type}-${index}`,
        timestamp: log.timestamp || '',
        type: messageType,
        rawContent,
        taskId: log.task_id || '',
        iteration: log.iteration || 0,
        messageType: type,
        metadata: { ...metadata, rawContent },
        questionNumber: metadata.question_number as number | undefined,
        criterion: metadata.criterion as string | undefined,
      };
    });

    const sorted = chatMessages.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    return sortOrder === 'newest' ? sorted.reverse() : sorted;
  }, [logs, sortOrder]);

  return (
    <div className={`${className} bg-slate-50 rounded-xl p-4`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Conversation</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 uppercase tracking-wide">Sort:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'oldest' | 'newest')}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white shadow-sm"
          >
            <option value="oldest">Oldest First</option>
            <option value="newest">Newest First</option>
          </select>
        </div>
      </div>

      <div className="space-y-3 max-h-[80vh] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No conversation logs available</div>
        ) : (
          messages.map((message) => {
            const isInterrogationMsg = message.messageType.includes('INTERROGATION');
            const isFixPrompt = message.messageType === 'FIX_PROMPT';
            const isSupervisor = message.type === 'supervisor';

            let cardStyle: string, dotColor: string, labelColor: string;
            if (isFixPrompt) {
              cardStyle = 'bg-yellow-50 border-yellow-300';
              dotColor = 'bg-yellow-500';
              labelColor = 'text-yellow-700';
            } else if (isInterrogationMsg) {
              cardStyle = isSupervisor ? 'bg-purple-50 border-purple-300' : 'bg-amber-50 border-amber-300';
              dotColor = isSupervisor ? 'bg-purple-500' : 'bg-amber-500';
              labelColor = isSupervisor ? 'text-purple-700' : 'text-amber-700';
            } else {
              cardStyle = isSupervisor ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200';
              dotColor = isSupervisor ? 'bg-blue-500' : 'bg-green-500';
              labelColor = isSupervisor ? 'text-blue-700' : 'text-green-700';
            }

            const supervisorPreview = isSupervisor
              ? getSupervisorPreview(message.rawContent, message.metadata || {})
              : null;
            const agentPreview = !isSupervisor ? getAgentPreview(message.rawContent) : '';

            return (
              <div
                key={message.id}
                className={`flex ${isSupervisor ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-2xl w-full rounded-xl border shadow-sm ${cardStyle}`}>
                  {/* Header row */}
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                    <span className={`text-xs font-semibold ${labelColor}`}>
                      {isSupervisor ? 'Supervisor' : 'Agent'}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-600 font-medium">
                      {formatMessageType(message.messageType)}
                    </span>
                    {isInterrogationMsg && message.questionNumber && (
                      <span className="px-1.5 py-0.5 bg-purple-200 text-purple-800 text-xs font-bold rounded">
                        #{message.questionNumber}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-gray-400">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>

                  {/* Preview */}
                  <div className="px-4 py-2 text-sm text-gray-700">
                    {isSupervisor && supervisorPreview ? (
                      <>
                        {supervisorPreview.intent && (
                          <div className="text-xs text-gray-400 mb-1">
                            {supervisorPreview.intent}
                          </div>
                        )}
                        {supervisorPreview.description && (
                          <div className="text-gray-800">{supervisorPreview.description}</div>
                        )}
                      </>
                    ) : (
                      <div className="max-h-40 overflow-hidden">
                        {agentPreview}
                      </div>
                    )}
                  </div>

                  {/* Footer: View Details */}
                  <div className="px-4 pb-3 flex justify-end">
                    <button
                      onClick={() => setSelectedMessage(message)}
                      className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 transition-colors"
                    >
                      View details →
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <DetailModal
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
        formatMessageType={formatMessageType}
        formatTimestamp={formatTimestamp}
      />
    </div>
  );
}
