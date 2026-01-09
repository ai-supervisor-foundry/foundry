import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import StatusBadge from '../components/StatusBadge';

const LocalProvider = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string>('');
  const [ollamaStatus, setOllamaStatus] = useState<'ACTIVE' | 'UNREACHABLE' | 'UNKNOWN'>('UNKNOWN');
  const [ollamaVersion, setOllamaVersion] = useState<string>('');
  const [models, setModels] = useState<any[]>([]);
  
  // Pagination
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    // Get first available project ID
    apiClient.getProjects().then(res => {
        if (res.data.projects && res.data.projects.length > 0) {
            setProjectId(res.data.projects[0]);
        }
    });

    // Fetch Ollama Status & Models
    apiClient.getOllamaVersion().then(res => {
        setOllamaVersion(res.data.version);
        setOllamaStatus('ACTIVE');
    }).catch(() => {
        setOllamaStatus('UNREACHABLE');
    });

    apiClient.getOllamaModels().then(res => {
        setModels(res.data.models || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (projectId) {
        fetchLogs();
    }
  }, [projectId, offset]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getPromptLogs(projectId, limit, undefined, 'ollama', offset);
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
      if (!confirm('Are you sure you want to stop the Ollama service? You will need to restart it manually via terminal.')) return;
      try {
          await apiClient.stopOllama();
          setOllamaStatus('UNREACHABLE');
      } catch (e) {
          alert('Failed to stop service');
      }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Local Provider (Ollama)</h1>
        <button onClick={fetchLogs} className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded">Refresh Data</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border relative">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
            <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={ollamaStatus === 'ACTIVE' ? 'RUNNING' : ollamaStatus === 'UNREACHABLE' ? 'HALTED' : undefined} /> 
                <span className="text-sm text-gray-600">
                    {ollamaStatus === 'ACTIVE' ? `v${ollamaVersion}` : ''}
                </span>
            </div>
            {ollamaStatus === 'ACTIVE' && (
                <button 
                    onClick={handleStop}
                    className="absolute top-4 right-4 text-xs bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded"
                >
                    Stop Service
                </button>
            )}
        </div>
        
        {/* Models Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Available Models ({models.length})</h3>
            <div className="text-sm font-mono max-h-24 overflow-y-auto">
                {models.length > 0 ? (
                    models.map((m: any) => <div key={m.name} className="truncate" title={m.name}>{m.name}</div>)
                ) : (
                    <span className="text-gray-400">Loading or None...</span>
                )}
            </div>
        </div>

        {/* Config Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Base URL</h3>
            <span className="text-sm font-mono text-gray-600">http://localhost:11434</span>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">Interaction History</h2>
            <span className="text-sm text-gray-500">Total: {total}</span>
        </div>
        
        {loading ? (
            <div className="p-8 text-center text-gray-500">Loading logs...</div>
        ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No interaction history found for Ollama provider.</div>
        ) : (
            <>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Output</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {logs.map((log, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            log.type === 'HELPER_AGENT_RESPONSE' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                        }`}>
                                            {log.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                                        {log.task_id}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {log.metadata?.duration_ms ? `${log.metadata.duration_ms}ms` : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate" title={log.content}>
                                        {log.content.substring(0, 100)}...
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination Footer */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t flex justify-between items-center bg-gray-50">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setOffset(Math.max(0, offset - limit))}
                            className="px-3 py-1 border rounded bg-white disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                        <button 
                            disabled={currentPage === totalPages}
                            onClick={() => setOffset(offset + limit)}
                            className="px-3 py-1 border rounded bg-white disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
};

export default LocalProvider;
