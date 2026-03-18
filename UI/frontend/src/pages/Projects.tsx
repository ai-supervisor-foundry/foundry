// Projects Page
// Project registry management: registered projects, discovered sandbox dirs, add/remove
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';

interface Project {
  id: string;
  name: string;
  path: string;
  registered_at: string;
  status: 'active' | 'archived';
  git_head?: string | null;
  checked_out_branch?: string | null;
}

interface DiscoveredProject {
  id: string;
  path: string;
  registered: boolean;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newProject, setNewProject] = useState({ id: '', name: '', gitUrl: '', branch: '' });
  const [addError, setAddError] = useState<string | null>(null);
  const [isCloning, setIsCloning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [projRes, discRes] = await Promise.all([
        apiClient.getProjects(),
        apiClient.getDiscoveredProjects(),
      ]);
      setProjects(projRes.data.projects || []);
      setDiscovered(discRes.data.projects || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRegister = async (id: string, name?: string) => {
    try {
      await apiClient.registerProject(id, name || id, id);
      fetchData();
    } catch (error) {
      console.error('Error registering project:', error);
      alert('Failed to register project');
    }
  };

  const handleUnregister = async (id: string) => {
    if (!confirm(`Unregister project "${id}"? This only removes it from the registry, not from disk.`)) return;
    try {
      await apiClient.unregisterProject(id);
      fetchData();
    } catch (error) {
      console.error('Error unregistering project:', error);
      alert('Failed to unregister project');
    }
  };

  const handleAddManual = async () => {
    if (!newProject.id || !newProject.name) {
      setAddError('Project ID and Name are required');
      return;
    }
    setAddError(null);
    setIsCloning(!!newProject.gitUrl);
    try {
      await apiClient.registerProject(
        newProject.id,
        newProject.name,
        newProject.id,
        newProject.gitUrl || undefined,
        newProject.branch || undefined,
      );
      setIsAdding(false);
      setIsCloning(false);
      setNewProject({ id: '', name: '', gitUrl: '', branch: '' });
      fetchData();
    } catch (error: any) {
      setIsCloning(false);
      const errData = error?.response?.data?.error;
      if (errData?.hint) {
        setAddError(`${errData.code}: ${errData.hint}`);
      } else {
        setAddError('Failed to add project');
      }
      console.error('Error adding project:', error);
    }
  };

  const unregisteredDirs = discovered.filter(d => !d.registered);

  const handleOpenFolder = async (id: string) => {
    try {
      await apiClient.openProjectFolder(id);
    } catch {
      alert('Could not open folder (runs on the machine hosting the UI backend).');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Projects</h2>
        <button
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium"
        >
          + Add Project
        </button>
      </div>

      {/* Registered Projects */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3">Registered Projects</h3>
        {projects.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Path</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">HEAD</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registered</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td className="px-6 py-4 text-sm font-mono font-medium text-gray-900">{project.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{project.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">{project.path}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-700">
                      {project.checked_out_branch ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">
                      {project.git_head ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        project.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(project.registered_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenFolder(project.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Open folder
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnregister(project.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 italic">No registered projects. Register sandbox directories below or add manually.</p>
        )}
      </div>

      {/* Discovered but Unregistered */}
      {unregisteredDirs.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Discovered in Sandbox (Unregistered)</h3>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Directory</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {unregisteredDirs.map((dir) => (
                  <tr key={dir.id}>
                    <td className="px-6 py-4 text-sm font-mono text-gray-700">{dir.id}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRegister(dir.id)}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        + Add to System
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {isAdding && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => { setIsAdding(false); setAddError(null); }}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Add Project</h3>
              <button onClick={() => { setIsAdding(false); setAddError(null); }} className="text-gray-500 hover:text-gray-700">
                X
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newProject.id}
                  onChange={(e) => setNewProject({ ...newProject, id: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="my-project"
                />
                <p className="text-xs text-gray-500 mt-1">Alphanumeric, hyphens, underscores. Used as sandbox directory name.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="My Project"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Git URL <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newProject.gitUrl}
                  onChange={(e) => setNewProject({ ...newProject, gitUrl: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="https://github.com/org/repo.git"
                />
                <p className="text-xs text-gray-500 mt-1">If provided, the repo will be cloned into sandbox/{newProject.id || '<id>'}.</p>
              </div>
              {newProject.gitUrl && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Branch <span className="text-gray-400 font-normal">(optional — defaults to repo default)</span>
                  </label>
                  <input
                    type="text"
                    value={newProject.branch}
                    onChange={(e) => setNewProject({ ...newProject, branch: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="main"
                  />
                </div>
              )}
              {addError && (
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{addError}</p>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => { setIsAdding(false); setAddError(null); }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                  disabled={isCloning}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddManual}
                  disabled={isCloning}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {isCloning ? 'Cloning...' : 'Register'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
