// Tasks Page
// Current task, queue, completed tasks, and blocked tasks
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import TaskCard from '../components/TaskCard';
import AutoRefresh from '../components/AutoRefresh';

const PER_PAGE_OPTIONS = [5, 10, 20, 50, 100];

export default function Tasks() {
  const [currentTask, setCurrentTask] = useState<any>(null);
  const [queue, setQueue] = useState<any>(null);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [blockedTasks, setBlockedTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskJson, setNewTaskJson] = useState(`{
  "task_id": "task-${Date.now()}",
  "intent": "Example task",
  "tool": "cursor",
  "instructions": "Describe what needs to be done...",
  "acceptance_criteria": [
    "Criteria 1"
  ],
  "working_directory": ".",
  "agent_mode": "auto"
}`);

  const [editForm, setEditForm] = useState<{ status: string; reason: string; otherFields: string }>({
    status: '',
    reason: '',
    otherFields: '{}'
  });
  
  // Pagination state for each section
  const [queuePage, setQueuePage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [blockedPage, setBlockedPage] = useState(1);
  
  // Items per page for each section (default: 5)
  const [queuePerPage, setQueuePerPage] = useState(5);
  const [completedPerPage, setCompletedPerPage] = useState(5);
  const [blockedPerPage, setBlockedPerPage] = useState(5);

  const fetchData = useCallback(async () => {
    try {
      // Fetch all tasks (we'll paginate client-side)
      const [currentRes, queueRes, completedRes, blockedRes] = await Promise.all([
        apiClient.getCurrentTask().catch(() => ({ data: null })),
        apiClient.getQueue(1000), // Fetch all for pagination
        apiClient.getCompletedTasks(),
        apiClient.getBlockedTasks(),
      ]);
      setCurrentTask(currentRes.data);
      setQueue(queueRes.data);
      setCompletedTasks(completedRes.data.tasks || []);
      setBlockedTasks(blockedRes.data.tasks || []);
    } catch (error) {
      console.error('Error fetching tasks data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEdit = (task: any) => {
    setEditingTask(task);
    // Separate status/reason from other fields for easier editing
    const { status, reason, task_id, ...others } = task;
    
    // We don't want to edit task_id
    setEditForm({
      status: status || (task.completed_at ? 'completed' : task.blocked_at ? 'blocked' : 'pending'),
      reason: reason || '',
      otherFields: JSON.stringify(others, null, 2)
    });
  };

  const handleSaveTask = async () => {
    if (!editingTask) return;
    
    try {
      let parsedOthers = {};
      try {
        parsedOthers = JSON.parse(editForm.otherFields);
      } catch (e) {
        alert('Invalid JSON in other fields');
        return;
      }

      const updates = {
        ...parsedOthers,
        status: editForm.status,
        reason: editForm.reason
      };

      await apiClient.updateTask(editingTask.task_id, updates);
      setEditingTask(null);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    }
  };

  const handleDumpTasks = async () => {
    try {
      const response = await apiClient.dumpTasks();
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks-dump-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error dumping tasks:', error);
      alert('Failed to dump tasks');
    }
  };

  const handleAddTask = async () => {
    try {
      let task;
      try {
        task = JSON.parse(newTaskJson);
      } catch (e) {
        alert('Invalid JSON');
        return;
      }
      
      await apiClient.enqueueTask(task);
      setIsAddingTask(false);
      // Reset form with new timestamp
      setNewTaskJson(`{
  "task_id": "task-${Date.now()}",
  "intent": "Example task",
  "tool": "cursor",
  "instructions": "Describe what needs to be done...",
  "acceptance_criteria": [
    "Criteria 1"
  ],
  "working_directory": ".",
  "agent_mode": "auto"
}`);
      fetchData();
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task');
    }
  };

  // Pagination helpers
  const paginate = <T,>(items: T[], page: number, perPage: number) => {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return {
      items: items.slice(start, end),
      totalPages: Math.ceil(items.length / perPage),
      currentPage: page,
      totalItems: items.length,
    };
  };

  const PaginationControls = ({ 
    currentPage, 
    totalPages, 
    onPageChange,
    totalItems,
    perPage,
    onPerPageChange
  }: { 
    currentPage: number; 
    totalPages: number; 
    onPageChange: (page: number) => void;
    totalItems: number;
    perPage: number;
    onPerPageChange: (perPage: number) => void;
  }) => {
    // Reset to page 1 when per page changes
    const handlePerPageChange = (newPerPage: number) => {
      onPerPageChange(newPerPage);
      onPageChange(1);
    };

    return (
      <div className="flex items-center justify-between mt-4 px-2 py-2 border-t border-gray-200">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages} ({totalItems} total)
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Show:</label>
            <select
              value={perPage}
              onChange={(e) => handlePerPageChange(Number(e.target.value))}
              className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PER_PAGE_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <span className="text-sm text-gray-600">per page</span>
          </div>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`px-3 py-1.5 text-sm border rounded ${
                      currentPage === pageNum
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <AutoRefresh enabled={autoRefresh} interval={60000} onRefresh={fetchData}>
      <div className="px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Tasks</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsAddingTask(true)}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium"
            >
              + Add Task
            </button>
            <button
              onClick={handleDumpTasks}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm font-medium"
            >
              ⬇ Dump
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
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

        <div className="space-y-6">
          <div className="border-l-4 border-blue-500 pl-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-lg font-semibold">
                In Progress
              </h3>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                {currentTask ? 1 : 0}
              </span>
            </div>
            {currentTask ? (
              <TaskCard 
                task={currentTask} 
                isCurrent={true} 
                onEdit={handleEdit}
              />
            ) : (
              <p className="text-gray-500 italic">No task in progress</p>
            )}
          </div>

          <div className="border-l-4 border-gray-300 pl-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">
                  Queue
                </h3>
                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">
                  {queue?.length || 0}
                </span>
              </div>
            </div>
            {queue?.pending && queue.pending.length > 0 ? (
              <>
                {(() => {
                  const queuePagination = paginate(queue.pending, queuePage, queuePerPage);
                  return (
                    <>
                      <div className="space-y-2">
                        {queuePagination.items.map((task: any, index: number) => {
                          // Check if this task matches the current task being processed
                          const isCurrentTask = currentTask?.task_id === task.task_id;
                          return (
                            <TaskCard 
                              key={task.task_id || index} 
                              task={task} 
                              isCurrent={isCurrentTask}
                              onEdit={handleEdit}
                            />
                          );
                        })}
                      </div>
                      <PaginationControls
                        currentPage={queuePage}
                        totalPages={queuePagination.totalPages}
                        onPageChange={setQueuePage}
                        totalItems={queuePagination.totalItems}
                        perPage={queuePerPage}
                        onPerPageChange={setQueuePerPage}
                      />
                    </>
                  );
                })()}
              </>
            ) : (
              <p className="text-gray-500">No pending tasks in queue</p>
            )}
          </div>

          <div className="border-l-4 border-green-500 pl-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-lg font-semibold">
                Completed Tasks
              </h3>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                {completedTasks.length}
              </span>
            </div>
            {completedTasks.length > 0 ? (
              <>
                {(() => {
                  const sortedCompleted = [...completedTasks].sort((a, b) => {
                    // Sort by completed_at descending (most recent first)
                    const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
                    const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
                    return dateB - dateA;
                  });
                  const completedPagination = paginate(sortedCompleted, completedPage, completedPerPage);
                  return (
                    <>
                      <div className="space-y-3">
                        {completedPagination.items.map((task) => (
                          <TaskCard 
                            key={task.task_id} 
                            task={task} 
                            isCurrent={currentTask?.task_id === task.task_id}
                            onEdit={handleEdit}
                          />
                        ))}
                      </div>
                      <PaginationControls
                        currentPage={completedPage}
                        totalPages={completedPagination.totalPages}
                        onPageChange={setCompletedPage}
                        totalItems={completedPagination.totalItems}
                        perPage={completedPerPage}
                        onPerPageChange={setCompletedPerPage}
                      />
                    </>
                  );
                })()}
              </>
            ) : (
              <p className="text-gray-500 italic">No completed tasks</p>
            )}
          </div>

          <div className="border-l-4 border-red-500 pl-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-lg font-semibold">
                Blocked Tasks
              </h3>
              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                {blockedTasks.length}
              </span>
            </div>
            {blockedTasks.length > 0 ? (
              <>
                {(() => {
                  const sortedBlocked = [...blockedTasks].sort((a, b) => {
                    // Sort by blocked_at descending (most recent first)
                    const dateA = a.blocked_at ? new Date(a.blocked_at).getTime() : 0;
                    const dateB = b.blocked_at ? new Date(b.blocked_at).getTime() : 0;
                    return dateB - dateA;
                  });
                  const blockedPagination = paginate(sortedBlocked, blockedPage, blockedPerPage);
                  return (
                    <>
                      <div className="space-y-3">
                        {blockedPagination.items.map((task) => (
                          <TaskCard 
                            key={task.task_id} 
                            task={task} 
                            isCurrent={currentTask?.task_id === task.task_id}
                            onEdit={handleEdit}
                          />
                        ))}
                      </div>
                      <PaginationControls
                        currentPage={blockedPage}
                        totalPages={blockedPagination.totalPages}
                        onPageChange={setBlockedPage}
                        totalItems={blockedPagination.totalItems}
                        perPage={blockedPerPage}
                        onPerPageChange={setBlockedPerPage}
                      />
                    </>
                  );
                })()}
              </>
            ) : (
              <p className="text-gray-500 italic">No blocked tasks</p>
            )}
          </div>
        </div>

        {/* View Details Modal */}
        {selectedTask && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setSelectedTask(null)}
          >
            <div
              className="bg-white rounded-lg p-6 max-w-2xl max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Task Details</h3>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(selectedTask, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Edit Task Modal */}
        {editingTask && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setEditingTask(null)}
          >
            <div
              className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Edit Task: {editingTask.task_id}</h3>
                <button
                  onClick={() => setEditingTask(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Notes</label>
                  <textarea
                    value={editForm.reason}
                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    rows={2}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Other Fields (JSON)</label>
                  <textarea
                    value={editForm.otherFields}
                    onChange={(e) => setEditForm({ ...editForm, otherFields: e.target.value })}
                    className="w-full border rounded px-3 py-2 font-mono text-sm"
                    rows={10}
                  />
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setEditingTask(null)}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTask}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Task Modal */}
        {isAddingTask && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setIsAddingTask(false)}
          >
            <div
              className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Add New Task</h3>
                <button
                  onClick={() => setIsAddingTask(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-2">
                  Enter the task JSON below. Ensure it has <code>task_id</code>, <code>instructions</code>, and <code>acceptance_criteria</code>.
                </p>
                
                <textarea
                  value={newTaskJson}
                  onChange={(e) => setNewTaskJson(e.target.value)}
                  className="w-full border rounded px-3 py-2 font-mono text-sm h-96"
                />
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setIsAddingTask(false)}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTask}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Add Task
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AutoRefresh>
  );
}

