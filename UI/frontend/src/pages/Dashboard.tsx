// Dashboard Page
// Supervisor status, goals, queue status, and quick stats
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import AutoRefresh from '../components/AutoRefresh';

interface Goal {
  description: string;
  completed: boolean;
  project_id: string;
}

interface SupervisorState {
  supervisor: {
    status: 'RUNNING' | 'HALTED' | 'BLOCKED' | 'COMPLETED';
    iteration?: number;
    halt_reason?: string;
    halt_details?: string;
  };
  goals: Record<string, Goal>;
  queue: {
    exhausted: boolean;
  };
  completed_tasks?: any[];
  blocked_tasks?: any[];
  last_updated: string;
}

export default function Dashboard() {
  const [state, setState] = useState<SupervisorState | null>(null);
  const [queue, setQueue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editedGoalText, setEditedGoalText] = useState('');
  const [newGoalProjectId, setNewGoalProjectId] = useState('');
  const [newGoalDescription, setNewGoalDescription] = useState('');
  const [showAddGoal, setShowAddGoal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [stateRes, queueRes] = await Promise.all([
        apiClient.getState(),
        apiClient.getQueue(),
      ]);
      setState(stateRes.data);
      setQueue(queueRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveGoal = async (projectId: string) => {
    if (!state) return;
    try {
      await apiClient.setGoal(editedGoalText, projectId);
      setEditingGoalId(null);
      fetchData();
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };

  const handleAddGoal = async () => {
    if (!newGoalProjectId.trim() || !newGoalDescription.trim()) return;
    try {
      await apiClient.setGoal(newGoalDescription, newGoalProjectId);
      setShowAddGoal(false);
      setNewGoalProjectId('');
      setNewGoalDescription('');
      fetchData();
    } catch (error) {
      console.error('Error adding goal:', error);
    }
  };

  const handleToggleStatus = async () => {
    if (!state) return;
    const isRunning = state.supervisor.status === 'RUNNING';
    try {
      if (isRunning) {
        await apiClient.haltSupervisor();
      } else {
        await apiClient.resumeSupervisor();
      }
      setTimeout(fetchData, 500);
    } catch (error) {
      console.error('Error toggling status:', error);
      alert(`Failed to ${isRunning ? 'halt' : 'resume'} supervisor`);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!state) {
    return <div className="text-center py-8 text-red-600">Supervisor state not found</div>;
  }

  const goalEntries = Object.entries(state.goals || {});
  const allGoalsCompleted = goalEntries.length > 0 && goalEntries.every(([, g]) => g.completed);

  return (
    <AutoRefresh enabled={autoRefresh} interval={60000} onRefresh={fetchData}>
      <div className="px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Dashboard</h2>
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
              onClick={fetchData}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white col-span-2 rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <button
                onClick={handleToggleStatus}
                className={`text-xs px-2 py-1 rounded font-medium border ${
                  state.supervisor.status === 'RUNNING'
                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                }`}
              >
                {state.supervisor.status === 'RUNNING' ? 'STOP' : 'START'}
              </button>
            </div>
            <StatusBadge status={state.supervisor.status} size="lg" />
            {state.supervisor.halt_reason && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
                <span className="font-semibold block mb-1">Reason:</span>
                {state.supervisor.halt_reason}
                {state.supervisor.halt_details && (
                  <div className="mt-1 text-gray-600 font-mono text-[10px] break-words">
                    {state.supervisor.halt_details}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Iteration</h3>
            <p className="text-2xl font-bold">{state.supervisor.iteration || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Queue Length</h3>
            <p className="text-2xl font-bold">{queue?.length || 0}</p>
            {queue?.exhausted && (
              <p className="text-sm text-gray-500 mt-1">Exhausted</p>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Completed Tasks</h3>
            <p className="text-2xl font-bold">{state.completed_tasks?.length || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">
                Goals
                {goalEntries.length > 0 && (
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                    allGoalsCompleted
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {allGoalsCompleted ? 'All Completed' : `${goalEntries.filter(([,g]) => g.completed).length}/${goalEntries.length}`}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowAddGoal(!showAddGoal)}
                className="text-sm text-blue-500 hover:underline"
              >
                + Add Goal
              </button>
            </div>

            {showAddGoal && (
              <div className="mb-4 p-3 bg-gray-50 rounded border">
                <input
                  type="text"
                  placeholder="Project ID"
                  className="w-full p-2 border rounded mb-2 text-sm font-mono"
                  value={newGoalProjectId}
                  onChange={(e) => setNewGoalProjectId(e.target.value)}
                />
                <textarea
                  placeholder="Goal description"
                  className="w-full p-2 border rounded mb-2 text-sm"
                  value={newGoalDescription}
                  onChange={(e) => setNewGoalDescription(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddGoal}
                    className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setShowAddGoal(false); setNewGoalProjectId(''); setNewGoalDescription(''); }}
                    className="px-3 py-1 bg-gray-300 text-sm rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {goalEntries.length === 0 ? (
              <p className="text-gray-500 text-sm">No goals set. Add a goal to get started.</p>
            ) : (
              <div className="space-y-3">
                {goalEntries.map(([projectId, goal]) => (
                  <div key={projectId} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-mono text-xs rounded">
                        {projectId}
                      </span>
                      <div className="flex items-center gap-2">
                        {goal.completed ? (
                          <span className="text-xs text-green-600 font-medium">Completed</span>
                        ) : (
                          <span className="text-xs text-yellow-600 font-medium">In Progress</span>
                        )}
                        {editingGoalId !== projectId && (
                          <button
                            onClick={() => { setEditingGoalId(projectId); setEditedGoalText(goal.description); }}
                            className="text-xs text-blue-500 hover:underline"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {editingGoalId === projectId ? (
                      <div className="mt-2">
                        <textarea
                          className="w-full p-2 border rounded text-sm"
                          value={editedGoalText}
                          onChange={(e) => setEditedGoalText(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => handleSaveGoal(projectId)}
                            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingGoalId(null)}
                            className="px-3 py-1 bg-gray-300 text-sm rounded hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-700 text-sm mt-1">{goal.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Blocked Tasks:</span>
                <span className="font-medium">{state.blocked_tasks?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Queue Exhausted:</span>
                <span className="font-medium">{state.queue.exhausted ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Updated:</span>
                <span className="font-medium text-sm">
                  {new Date(state.last_updated).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AutoRefresh>
  );
}
