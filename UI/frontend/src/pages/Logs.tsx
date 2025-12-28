// Logs Page
// Audit log timeline and prompt log list
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import LogViewer from '../components/LogViewer';
import ChatVisualizer from '../components/ChatVisualizer';
import AutoRefresh from '../components/AutoRefresh';

export default function Logs() {
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [promptLogs, setPromptLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<'audit' | 'prompts' | 'chat'>('audit');
  const [limit, setLimit] = useState(50);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await apiClient.getProjects();
      const projectList = res.data.projects || [];
      setProjects(projectList);
      if (projectList.length > 0 && !selectedProject) {
        setSelectedProject(projectList[0]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setLoading(false);
    }
  }, [selectedProject]);

  const fetchLogs = useCallback(async () => {
    if (!selectedProject) return;

    try {
      if (activeTab === 'audit') {
        const res = await apiClient.getAuditLogs(selectedProject, limit);
        setAuditLogs(res.data.logs || []);
      } else if (activeTab === 'prompts') {
        const res = await apiClient.getPromptLogs(selectedProject, limit);
        setPromptLogs(res.data.logs || []);
      } else if (activeTab === 'chat') {
        // For chat visualization, we need all prompt logs to show the conversation
        const res = await apiClient.getPromptLogs(selectedProject, limit * 2); // Get more for conversation context
        setPromptLogs(res.data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, activeTab, limit]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (selectedProject) {
      setLoading(true);
      fetchLogs();
    }
  }, [selectedProject, activeTab, limit, fetchLogs]);

  return (
    <AutoRefresh enabled={autoRefresh && selectedProject !== ''} interval={60000} onRefresh={fetchLogs}>
      <div className="px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Logs</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span className="text-sm">Auto-refresh</span>
            </label>
            <button
              onClick={fetchLogs}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">Select project...</option>
              {projects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Limit
            </label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="border rounded px-3 py-2 w-20"
              min="1"
              max="1000"
            />
          </div>
        </div>

        <div className="mb-4 border-b">
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 ${
              activeTab === 'audit'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500'
            }`}
          >
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`px-4 py-2 ${
              activeTab === 'prompts'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500'
            }`}
          >
            Prompt Logs
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 ${
              activeTab === 'chat'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500'
            }`}
          >
            Visualize Chat
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : selectedProject ? (
          activeTab === 'chat' ? (
            <ChatVisualizer
              logs={promptLogs}
              className="bg-white rounded-lg shadow p-6"
            />
          ) : (
            <LogViewer
              logs={activeTab === 'audit' ? auditLogs : promptLogs}
              className="bg-white rounded-lg shadow p-6"
            />
          )
        ) : (
          <div className="text-center py-8 text-gray-500">
            Please select a project to view logs
          </div>
        )}
      </div>
    </AutoRefresh>
  );
}

