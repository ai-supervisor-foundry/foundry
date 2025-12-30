// Command Executor Page
// Supervisor commands and shell commands tabs
import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import CommandOutput from '../components/CommandOutput';

const SUPERVISOR_COMMANDS = [
  'init-state',
  'set-goal',
  'enqueue',
  'halt',
  'resume',
  'status',
  'start',
] as const;

export default function CommandExecutor() {
  const [activeTab, setActiveTab] = useState<'supervisor' | 'shell'>('supervisor');
  const [supervisorCommand, setSupervisorCommand] = useState<string>('status');
  const [supervisorOptions, setSupervisorOptions] = useState<string>('{}');
  const [shellCommand, setShellCommand] = useState<string>('');
  const [shellCwd, setShellCwd] = useState<string>('');
  const [output, setOutput] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await apiClient.getCommandHistory(20);
      setHistory(res.data.history || []);
    } catch (error) {
      console.error('Error fetching command history:', error);
    }
  };

  const executeSupervisorCommand = async () => {
    setLoading(true);
    setOutput(null);
    try {
      let options = {};
      try {
        options = JSON.parse(supervisorOptions);
      } catch {
        // Invalid JSON, use empty object
      }
      const res = await apiClient.executeSupervisorCommand(supervisorCommand, options);
      setOutput(res.data);
      fetchHistory();
    } catch (error: any) {
      setOutput({
        stdout: '',
        stderr: error.response?.data?.error || error.message || 'Unknown error',
        exitCode: 1,
        duration: 0,
        success: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const executeShellCommand = async () => {
    if (!shellCommand.trim()) return;

    setLoading(true);
    setOutput(null);
    try {
      const res = await apiClient.executeShellCommand(
        shellCommand,
        shellCwd || undefined,
        30000
      );
      setOutput(res.data);
      fetchHistory();
    } catch (error: any) {
      setOutput({
        stdout: '',
        stderr: error.response?.data?.error || error.message || 'Unknown error',
        exitCode: 1,
        duration: 0,
        success: false,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <h2 className="text-2xl font-bold mb-6">Command Executor</h2>

      <div className="mb-4 border-b">
        <button
          onClick={() => setActiveTab('supervisor')}
          className={`px-4 py-2 ${
            activeTab === 'supervisor'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500'
          }`}
        >
          Supervisor Commands
        </button>
        <button
          onClick={() => setActiveTab('shell')}
          className={`px-4 py-2 ${
            activeTab === 'shell'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500'
          }`}
        >
          Shell Commands
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          {activeTab === 'supervisor' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Command
                </label>
                <select
                  value={supervisorCommand}
                  onChange={(e) => setSupervisorCommand(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  {SUPERVISOR_COMMANDS.map((cmd) => (
                    <option key={cmd} value={cmd}>
                      {cmd}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Options (JSON)
                </label>
                <textarea
                  value={supervisorOptions}
                  onChange={(e) => setSupervisorOptions(e.target.value)}
                  className="w-full border rounded px-3 py-2 font-mono text-sm"
                  rows={4}
                  placeholder='{"reason": "..."}'
                />
              </div>
              <button
                onClick={executeSupervisorCommand}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Executing...' : 'Execute'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Command
                </label>
                <input
                  type="text"
                  value={shellCommand}
                  onChange={(e) => setShellCommand(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && executeShellCommand()}
                  className="w-full border rounded px-3 py-2 font-mono"
                  placeholder="ls -la"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Working Directory (optional)
                </label>
                <input
                  type="text"
                  value={shellCwd}
                  onChange={(e) => setShellCwd(e.target.value)}
                  className="w-full border rounded px-3 py-2 font-mono text-sm"
                  placeholder="/path/to/directory"
                />
              </div>
              <button
                onClick={executeShellCommand}
                disabled={loading || !shellCommand.trim()}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Executing...' : 'Execute'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Output</h3>
          {output ? (
            <CommandOutput
              stdout={output.stdout || ''}
              stderr={output.stderr || ''}
              exitCode={output.exitCode}
            />
          ) : (
            <div className="text-gray-500 text-center py-8">
              No output yet. Execute a command to see results.
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Command History</h3>
        <div className="space-y-2 max-h-64 overflow-auto">
          {history.map((entry, index) => (
            <div
              key={index}
              className="border rounded p-3 text-sm"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-mono">{entry.command}</span>
                <span className="text-gray-500 text-xs">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-gray-600">
                Type: {entry.type} | Exit: {entry.result.exitCode} | Duration: {entry.result.duration}ms
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-gray-500 text-center py-4">No command history</p>
          )}
        </div>
      </div>
    </div>
  );
}

