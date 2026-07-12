// API Client Service
// Axios wrapper with error handling and request interceptors
import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add any auth tokens or headers here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    // Handle common errors
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as any;
      
      if (status === 404) {
        // Don't log 404s for expected cases (e.g., no current task)
        // Only log if it's not a handled case
        if (!error.config?.url?.includes('/current-task')) {
          console.error('Resource not found:', error.config?.url);
        }
      } else if (status >= 500) {
        console.error('Server error:', data?.error || error.message);
      }
    } else if (error.request) {
      // Request made but no response
      console.error('No response from server:', error.config?.url);
    } else {
      // Error setting up request
      console.error('Request error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// API methods
export const apiClient = {
  // State endpoints
  getState: () => api.get('/api/state'),
  getStatus: () => api.get('/api/state/status'),
  getCurrentTask: () => api.get('/api/state/current-task'),
  setGoal: (description: string, projectId: string) =>
    apiClient.executeSupervisorCommand('set-goal', { description, 'project-id': projectId }),
  
  // Tasks endpoints
  getCompletedTasks: () => api.get('/api/tasks/completed'),
  getBlockedTasks: () => api.get('/api/tasks/blocked'),
  getQueue: (limit?: number) => api.get('/api/tasks/queue', { params: { limit } }),
  updateTask: (taskId: string, updates: Record<string, any>) => 
    api.post('/api/tasks/update', { taskId, updates }),
  enqueueTask: (task: any) => api.post('/api/tasks/enqueue', task),
  enqueueTasks: (tasks: any[]) => api.post('/api/tasks/enqueue-bulk', tasks),
  dumpTasks: () => api.get('/api/tasks/dump'),
  deleteTasks: (taskIds: string[], source: 'queue' | 'completed' | 'blocked') =>
    api.post('/api/tasks/delete', { taskIds, source }),
  
  // Logs endpoints
  getLogProjects: () => api.get('/api/logs/projects'),
  getAuditLogs: (projectId: string, limit?: number) =>
    api.get('/api/logs/audit', { params: { projectId, limit } }),
  getPromptLogs: (projectId: string, limit?: number, type?: string, provider?: string, offset?: number) =>
    api.get('/api/logs/prompts', { params: { projectId, limit, type, provider, offset } }),
  getAuditLogsByTask: (taskId: string, projectId: string) =>
    api.get(`/api/logs/audit/${taskId}`, { params: { projectId } }),
  getPromptLogsByTask: (taskId: string, projectId: string) =>
    api.get(`/api/logs/prompts/${taskId}`, { params: { projectId } }),
  
  // Commands endpoints
  executeSupervisorCommand: (command: string, options?: Record<string, any>) =>
    api.post('/api/commands/supervisor', { command, options }),
  executeShellCommand: (command: string, cwd?: string, timeout?: number) =>
    api.post('/api/commands/shell', { command, cwd, timeout }),
  getCommandHistory: (limit?: number) =>
    api.get('/api/commands/history', { params: { limit } }),
  
  // Config endpoint
  getConfig: () => api.get('/api/config'),
  updateConfig: (config: Record<string, any>) => api.post('/api/config', config),

  // Execution modes CRUD
  getExecutionModes: () => api.get('/api/config/execution-modes'),
  createExecutionMode: (mode: any) => api.post('/api/config/execution-modes', mode),
  updateExecutionMode: (id: string, mode: any) => api.put(`/api/config/execution-modes/${id}`, mode),
  deleteExecutionMode: (id: string) => api.delete(`/api/config/execution-modes/${id}`),

  // Strategies CRUD
  getStrategies: () => api.get('/api/config/strategies'),
  createStrategy: (strategy: any) => api.post('/api/config/strategies', strategy),
  updateStrategy: (id: string, strategy: any) => api.put(`/api/config/strategies/${id}`, strategy),
  deleteStrategy: (id: string) => api.delete(`/api/config/strategies/${id}`),

  // Preferences
  getPreferences: () => api.get('/api/config/preferences'),
  savePreferences: (prefs: { executionMode?: string; preserveGlobal?: boolean }) =>
    api.post('/api/config/preferences', prefs),

  // Settings (configurable, Postgres-backed)
  getSettings: () => api.get('/api/config/settings'),
  saveSetting: (key: string, value: string) =>
    api.post('/api/config/settings', { key, value }),

  // Ollama endpoints
  getOllamaVersion: () => api.get('/api/ollama/version'),
  getOllamaModels: () => api.get('/api/ollama/tags'),
  stopOllama: () => api.post('/api/ollama/stop'),

  // Projects endpoints
  getProjects: () => api.get('/api/projects'),
  getDiscoveredProjects: () => api.get('/api/projects/discovered'),
  registerProject: (id: string, name: string, projectPath?: string, gitUrl?: string, branch?: string) =>
    api.post('/api/projects', { id, name, path: projectPath || id, gitUrl, branch }),
  unregisterProject: (id: string) => api.delete(`/api/projects/${id}`),
  openProjectFolder: (id: string) => api.post(`/api/projects/${id}/open-folder`),

  // Supervisor control
  haltSupervisor: (reason: string = 'User requested halt via UI') => 
    apiClient.executeSupervisorCommand('halt', { reason }),
  resumeSupervisor: () => apiClient.executeSupervisorCommand('resume'),
};

export default api;

