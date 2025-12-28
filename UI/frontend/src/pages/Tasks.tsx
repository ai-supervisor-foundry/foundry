// Tasks Page
// Current task, queue, completed tasks, and blocked tasks
import React, { useState, useEffect, useCallback } from 'react';
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
    onPerPageChange,
    sectionName
  }: { 
    currentPage: number; 
    totalPages: number; 
    onPageChange: (page: number) => void;
    totalItems: number;
    perPage: number;
    onPerPageChange: (perPage: number) => void;
    sectionName: string;
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
          {currentTask && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Current Task</h3>
              <TaskCard task={currentTask} isCurrent={true} />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                Queue ({queue?.length || 0} pending)
              </h3>
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
                          // First task in queue is "next" to be processed
                          const isNext = queuePage === 1 && index === 0 && !currentTask;
                          return (
                            <TaskCard 
                              key={task.task_id || index} 
                              task={task} 
                              isCurrent={isCurrentTask || isNext}
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
                        sectionName="queue"
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
                        sectionName="completed"
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
                        sectionName="blocked"
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
      </div>
    </AutoRefresh>
  );
}

