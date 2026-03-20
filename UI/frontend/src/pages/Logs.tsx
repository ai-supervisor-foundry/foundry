// Logs Page
// Audit log timeline and prompt log list
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../services/api';
import LogViewer from '../components/LogViewer';
import ChatVisualizer from '../components/ChatVisualizer';
import AutoRefresh from '../components/AutoRefresh';

const VALID_TABS = ['audit', 'prompts', 'chat'] as const;
type TabType = typeof VALID_TABS[number];

export default function Logs() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [promptLogs, setPromptLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [limit, setLimit] = useState(50);

  // Derive tab and project from URL params
  const tabParam = searchParams.get('tab') as TabType | null;
  const activeTab: TabType = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'audit';
  const selectedProject = searchParams.get('project') || '';

  const setActiveTab = (tab: TabType) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const setSelectedProject = (project: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (project) next.set('project', project);
      else next.delete('project');
      return next;
    });
  };

  const fetchProjects = useCallback(async () => {
    try {
      const res = await apiClient.getLogProjects();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Logs</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Auto-refresh
            </label>
            <button
              onClick={fetchLogs}
              className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-5 flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm"
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
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Limit
            </label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-20 bg-white shadow-sm"
              min="1"
              max="1000"
            />
          </div>
        </div>

        <div className="mb-5 border-b border-gray-200 flex gap-0">
          {VALID_TABS.map((tab) => {
            const labels: Record<TabType, string> = { audit: 'Audit Logs', prompts: 'Prompt Logs', chat: 'Visualize Chat' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-gray-400">Loading...</div>
        ) : selectedProject ? (
          activeTab === 'chat' ? (
            <ChatVisualizer
              logs={promptLogs}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
            />
          ) : (
            <LogViewer
              logs={activeTab === 'audit' ? auditLogs : promptLogs}
              projectId={selectedProject}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
            />
          )
        ) : (
          <div className="text-center py-12 text-sm text-gray-400">
            Select a project to view logs
          </div>
        )}
      </div>
    </AutoRefresh>
  );
}

