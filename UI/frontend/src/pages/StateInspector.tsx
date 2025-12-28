// State Inspector Page
// JSON tree viewer for supervisor state
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import AutoRefresh from '../components/AutoRefresh';

export default function StateInspector() {
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']));

  const fetchState = useCallback(async () => {
    try {
      const res = await apiClient.getState();
      setState(res.data);
    } catch (error) {
      console.error('Error fetching state:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const togglePath = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const renderJsonValue = (value: any, path: string = '', depth: number = 0): React.ReactNode => {
    if (value === null) {
      return <span className="text-gray-500">null</span>;
    }

    if (typeof value === 'string') {
      const displayValue = searchTerm
        ? value.replace(
            new RegExp(`(${searchTerm})`, 'gi'),
            '<mark class="bg-yellow-200">$1</mark>'
          )
        : value;
      return <span className="text-green-600">"{displayValue}"</span>;
    }

    if (typeof value === 'number') {
      return <span className="text-blue-600">{value}</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="text-purple-600">{value.toString()}</span>;
    }

    if (Array.isArray(value)) {
      const isExpanded = expandedPaths.has(path);
      return (
        <div>
          <button
            onClick={() => togglePath(path)}
            className="text-gray-500 hover:text-gray-700"
          >
            {isExpanded ? '▼' : '▶'} [{value.length}]
          </button>
          {isExpanded && (
            <div className="ml-4 border-l-2 border-gray-300 pl-2">
              {value.map((item, index) => (
                <div key={index} className="my-1">
                  <span className="text-gray-500">[{index}]:</span>{' '}
                  {renderJsonValue(item, `${path}[${index}]`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (typeof value === 'object') {
      const isExpanded = expandedPaths.has(path);
      const keys = Object.keys(value);
      return (
        <div>
          <button
            onClick={() => togglePath(path)}
            className="text-gray-500 hover:text-gray-700"
          >
            {isExpanded ? '▼' : '▶'} {'{'} {keys.length} keys {'}'}
          </button>
          {isExpanded && (
            <div className="ml-4 border-l-2 border-gray-300 pl-2">
              {keys.map((key) => {
                const keyPath = path ? `${path}.${key}` : key;
                return (
                  <div key={key} className="my-1">
                    <span className="text-blue-600 font-semibold">"{key}"</span>:{' '}
                    {renderJsonValue(value[key], keyPath, depth + 1)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  const copyToClipboard = () => {
    if (state) {
      navigator.clipboard.writeText(JSON.stringify(state, null, 2));
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!state) {
    return <div className="text-center py-8 text-red-600">State not found</div>;
  }

  return (
    <AutoRefresh enabled={autoRefresh} interval={60000} onRefresh={fetchState}>
      <div className="px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">State Inspector</h2>
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
              onClick={fetchState}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh
            </button>
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Copy JSON
            </button>
          </div>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search in state..."
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="font-mono text-sm">
            {renderJsonValue(state)}
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          Last updated: {state.last_updated ? new Date(state.last_updated).toLocaleString() : 'N/A'}
        </div>
      </div>
    </AutoRefresh>
  );
}

