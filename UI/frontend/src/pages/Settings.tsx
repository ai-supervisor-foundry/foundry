// Settings Page
// Sidebar subsections: General, Strategies, Execution Modes
// Full CRUD for strategies and execution modes, editable system settings
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../services/api';
import { ExecutionMode, ExecutionModeEntry, Strategy, FALLBACK_MODES } from '../constants/executionModes';
import { PROVIDER_MODELS } from '../constants/providers/models';
import ConfirmModal from '../components/ConfirmModal';

type Section = 'general' | 'strategies' | 'execution-modes';

interface SettingItem {
  key: string; label: string; value: string;
  source: 'env' | 'postgres' | 'default';
  type: 'select' | 'text' | 'number';
  options?: string[]; description?: string; envOverride: boolean;
}

const PROVIDERS = Object.keys(PROVIDER_MODELS);

// Reusable chain editor for primary/secondary provider entries
function ChainEditor({ chain, onChange, label }: {
  chain: ExecutionModeEntry[]; onChange: (c: ExecutionModeEntry[]) => void; label: string;
}) {
  const addEntry = () => onChange([...chain, { provider: 'claude', agentMode: 'auto' }]);
  const removeEntry = (i: number) => onChange(chain.filter((_, idx) => idx !== i));
  const updateEntry = (i: number, field: 'provider' | 'agentMode', val: string) => {
    const next = [...chain];
    next[i] = { ...next[i], [field]: val };
    if (field === 'provider') next[i].agentMode = 'auto';
    onChange(next);
  };

  return (
    <div>
      <div className="text-xs font-medium text-gray-500 uppercase mb-1">{label}</div>
      {chain.map((entry, i) => (
        <div key={i} className="flex gap-2 mb-1">
          <select value={entry.provider} onChange={e => updateEntry(i, 'provider', e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm flex-1 bg-white">
            {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={entry.agentMode} onChange={e => updateEntry(i, 'agentMode', e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm flex-1 bg-white">
            {(PROVIDER_MODELS[entry.provider] || ['auto']).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={() => removeEntry(i)} className="text-red-500 hover:text-red-700 text-sm px-1.5" title="Remove" aria-label="Remove entry">x</button>
        </div>
      ))}
      <button onClick={addEntry} className="text-xs text-indigo-600 hover:text-indigo-800 mt-1">+ Add entry</button>
    </div>
  );
}

const VALID_SECTIONS: Section[] = ['general', 'strategies', 'execution-modes'];

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section') as Section | null;
  const section: Section = sectionParam && VALID_SECTIONS.includes(sectionParam) ? sectionParam : 'general';
  const setSection = (s: Section) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('section', s);
      return next;
    });
  };
  const [loading, setLoading] = useState(true);

  // General
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // Strategies
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [newStrategy, setNewStrategy] = useState(false);
  const [strategyForm, setStrategyForm] = useState<Strategy>({
    id: '', name: '', builtin: false, primary: [], secondary: [],
  });

  // Execution Modes
  const [executionModes, setExecutionModes] = useState<ExecutionMode[]>(FALLBACK_MODES);
  const [selectedMode, setSelectedMode] = useState('default');
  const [editingMode, setEditingMode] = useState<ExecutionMode | null>(null);
  const [newMode, setNewMode] = useState(false);
  const [modeForm, setModeForm] = useState<ExecutionMode>({
    id: '', label: '', icon: '', description: '', builtin: false,
    prefill: { tool: '', agentMode: '' }, primary: [], secondary: [],
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: string; id: string; label: string }>({
    open: false, type: '', id: '', label: '',
  });

  const loadAll = () => {
    Promise.all([
      apiClient.getSettings().catch(() => ({ data: [] })),
      apiClient.getStrategies().catch(() => ({ data: [] })),
      apiClient.getExecutionModes().catch(() => ({ data: FALLBACK_MODES })),
      apiClient.getPreferences().catch(() => ({ data: { executionMode: 'default' } })),
    ]).then(([settingsRes, stratRes, modesRes, prefsRes]) => {
      setSettings(settingsRes.data);
      const vals: Record<string, string> = {};
      settingsRes.data.forEach((s: SettingItem) => { vals[s.key] = s.value; });
      setEditValues(vals);
      setStrategies(stratRes.data);
      setExecutionModes(modesRes.data);
      setSelectedMode(prefsRes.data.executionMode || 'default');
      setLoading(false);
    });
  };

  useEffect(() => { loadAll(); }, []);

  // General settings handlers
  const handleSettingSave = async (key: string) => {
    try {
      await apiClient.saveSetting(key, editValues[key]);
      setSettings(prev => prev.map(s =>
        s.key === key ? { ...s, value: editValues[key], source: 'postgres' as const } : s
      ));
      toast.success('Setting saved');
    } catch { toast.error('Failed to save setting'); }
  };

  // Strategy handlers
  const handleSaveStrategy = async () => {
    try {
      if (newStrategy) {
        if (!strategyForm.id || !strategyForm.name) { toast.error('ID and name required'); return; }
        await apiClient.createStrategy(strategyForm);
        toast.success('Strategy created');
      } else if (editingStrategy) {
        await apiClient.updateStrategy(editingStrategy.id, strategyForm);
        toast.success('Strategy updated');
      }
      setEditingStrategy(null);
      setNewStrategy(false);
      loadAll();
    } catch { toast.error('Failed to save strategy'); }
  };

  const handleDeleteStrategy = async () => {
    try {
      await apiClient.deleteStrategy(deleteConfirm.id);
      toast.success('Strategy deleted');
      setDeleteConfirm({ open: false, type: '', id: '', label: '' });
      loadAll();
    } catch { toast.error('Failed to delete strategy'); }
  };

  // Execution mode handlers
  const handleModeSelect = async (modeId: string) => {
    setSelectedMode(modeId);
    try {
      await apiClient.savePreferences({ executionMode: modeId, preserveGlobal: true });
      toast.success('Default execution mode saved');
    } catch { toast.error('Failed to save preference'); }
  };

  const handleSaveMode = async () => {
    try {
      if (newMode) {
        if (!modeForm.id || !modeForm.label) { toast.error('ID and label required'); return; }
        await apiClient.createExecutionMode(modeForm);
        toast.success('Execution mode created');
      } else if (editingMode) {
        await apiClient.updateExecutionMode(editingMode.id, modeForm);
        toast.success('Execution mode updated');
      }
      setEditingMode(null);
      setNewMode(false);
      loadAll();
    } catch { toast.error('Failed to save execution mode'); }
  };

  const handleDeleteMode = async () => {
    try {
      await apiClient.deleteExecutionMode(deleteConfirm.id);
      toast.success('Execution mode deleted');
      setDeleteConfirm({ open: false, type: '', id: '', label: '' });
      loadAll();
    } catch { toast.error('Failed to delete execution mode'); }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  const sourceColor = (source: string) => {
    switch (source) {
      case 'env': return 'bg-amber-100 text-amber-800';
      case 'postgres': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };
  const sourceLabel = (source: string) => source === 'env' ? 'ENV' : source === 'postgres' ? 'DB' : 'DEFAULT';

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Settings</h2>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="w-48 shrink-0">
          <div className="space-y-1">
            {([
              { id: 'general' as Section, label: 'General' },
              { id: 'strategies' as Section, label: 'Strategies' },
              { id: 'execution-modes' as Section, label: 'Execution Modes' },
            ]).map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  section === item.id
                    ? 'bg-indigo-50 text-indigo-700 font-medium border border-indigo-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* ===== GENERAL ===== */}
          {section === 'general' && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-1">System Settings</h3>
              <p className="text-sm text-gray-500 mb-4">
                Saved to Postgres. <code className="text-xs bg-gray-100 px-1 rounded">.env</code> values take precedence at runtime.
              </p>

              <div className="space-y-4">
                {settings.map(setting => {
                  const changed = editValues[setting.key] !== setting.value;
                  // For provider_strategy, show strategy names
                  const strategyOptions = setting.key === 'provider_strategy'
                    ? strategies.map(s => ({ value: s.id, label: `${s.id} — ${s.name}` }))
                    : null;
                  return (
                    <div key={setting.key} className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-sm font-medium text-gray-700">{setting.label}</label>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sourceColor(setting.source)}`}>
                            {sourceLabel(setting.source)}
                          </span>
                        </div>
                        {setting.description && (
                          <div className="text-xs text-gray-400 mb-2">{setting.description}</div>
                        )}

                        {strategyOptions ? (
                          <select
                            value={editValues[setting.key] || setting.value}
                            onChange={e => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                            className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
                          >
                            {strategyOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : setting.type === 'select' ? (
                          <select
                            value={editValues[setting.key] || setting.value}
                            onChange={e => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                            className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
                          >
                            {setting.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input
                            type={setting.type}
                            value={editValues[setting.key] || setting.value}
                            onChange={e => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                            className="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
                          />
                        )}

                        {setting.envOverride && (
                          <div className="text-xs text-amber-600 mt-1">
                            .env is currently overriding this value at runtime.
                          </div>
                        )}
                      </div>
                      <div className="pt-6">
                        <button
                          onClick={() => handleSettingSave(setting.key)}
                          disabled={!changed}
                          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ===== STRATEGIES ===== */}
          {section === 'strategies' && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Provider Strategies</h3>
                  <p className="text-sm text-gray-500">Primary and secondary provider chains for task execution.</p>
                </div>
                <button
                  onClick={() => {
                    setNewStrategy(true);
                    setEditingStrategy(null);
                    setStrategyForm({ id: '', name: '', builtin: false, primary: [], secondary: [] });
                  }}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm transition-colors"
                >
                  + New Strategy
                </button>
              </div>

              <div className="space-y-3">
                {strategies.map(s => (
                  <div key={s.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.id} — {s.name}</span>
                          {s.builtin && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">built-in</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          <span className="font-medium">Primary:</span>{' '}
                          {s.primary.map(e => `${e.provider} (${e.agentMode})`).join(' → ')}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          <span className="font-medium">Secondary:</span>{' '}
                          {s.secondary.map(e => `${e.provider} (${e.agentMode})`).join(' → ')}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setNewStrategy(true);
                            setEditingStrategy(null);
                            setStrategyForm({ ...s, id: `${s.id}-copy`, name: `${s.name} (copy)`, builtin: false });
                          }}
                          className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          title="Duplicate strategy"
                          aria-label="Duplicate strategy"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>
                        <button
                          onClick={() => {
                            setEditingStrategy(s);
                            setNewStrategy(false);
                            setStrategyForm({ ...s });
                          }}
                          className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Edit
                        </button>
                        {!s.builtin && (
                          <button
                            onClick={() => setDeleteConfirm({ open: true, type: 'strategy', id: s.id, label: s.name })}
                            className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </section>
          )}

          {/* ===== EXECUTION MODES ===== */}
          {section === 'execution-modes' && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="text-lg font-semibold">Execution Modes</h3>
                  <p className="text-sm text-gray-500">Task creation presets. The selected mode auto-fills provider/model for new tasks.</p>
                </div>
                <button
                  onClick={() => {
                    setNewMode(true);
                    setEditingMode(null);
                    setModeForm({
                      id: '', label: '', icon: '', description: '', builtin: false,
                      prefill: { tool: '', agentMode: '' }, primary: [], secondary: [],
                    });
                  }}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm transition-colors"
                >
                  + New Mode
                </button>
              </div>

              {/* Active mode selector */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {executionModes.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => handleModeSelect(mode.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      selectedMode === mode.id
                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                    title={mode.description}
                  >
                    <div className="text-xl mb-0.5">{mode.icon}</div>
                    <div className="text-sm font-medium">{mode.label}</div>
                    {mode.prefill.tool && (
                      <div className="text-xs text-gray-500 mt-0.5">{mode.prefill.tool} / {mode.prefill.agentMode}</div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Selected mode applies to all new tasks. Override per-task in the task modal.
              </p>

              {/* Mode list with edit/delete */}
              <div className="space-y-3">
                {executionModes.map(mode => (
                  <div key={mode.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{mode.icon}</span>
                          <span className="font-medium">{mode.label}</span>
                          {mode.builtin && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">built-in</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{mode.description}</div>
                        {mode.prefill.tool && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            Prefill: {mode.prefill.tool} / {mode.prefill.agentMode}
                          </div>
                        )}
                        {mode.primary.length > 0 && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            Primary: {mode.primary.map(e => `${e.provider} (${e.agentMode})`).join(' → ')}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setNewMode(true);
                            setEditingMode(null);
                            setModeForm({
                              ...mode,
                              id: `${mode.id}-copy`,
                              label: `${mode.label} (copy)`,
                              builtin: false,
                              primary: [...mode.primary],
                              secondary: [...mode.secondary],
                            });
                          }}
                          className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          title="Duplicate execution mode"
                          aria-label="Duplicate execution mode"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>
                        <button
                          onClick={() => {
                            setEditingMode(mode);
                            setNewMode(false);
                            setModeForm({ ...mode });
                          }}
                          className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Edit
                        </button>
                        {!mode.builtin && (
                          <button
                            onClick={() => setDeleteConfirm({ open: true, type: 'mode', id: mode.id, label: mode.label })}
                            className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </section>
          )}
        </div>
      </div>

      {/* Strategy Create/Edit Modal */}
      {(newStrategy || editingStrategy) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { setNewStrategy(false); setEditingStrategy(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-auto border border-gray-200/50"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {newStrategy ? 'New Strategy' : `Edit Strategy: ${editingStrategy?.name}`}
              </h3>
              <button onClick={() => { setNewStrategy(false); setEditingStrategy(null); }}
                className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID <span className="text-red-500">*</span></label>
                  <input type="text" value={strategyForm.id}
                    onChange={e => setStrategyForm({ ...strategyForm, id: e.target.value })}
                    disabled={!!editingStrategy}
                    autoFocus={!editingStrategy}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm disabled:bg-gray-100"
                    placeholder="e.g. 4"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input type="text" value={strategyForm.name}
                    onChange={e => setStrategyForm({ ...strategyForm, name: e.target.value })}
                    autoFocus={!!editingStrategy}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
                    placeholder="e.g. my-custom-strategy"
                  />
                </div>
              </div>
              <ChainEditor label="Primary Chain" chain={strategyForm.primary}
                onChange={primary => setStrategyForm({ ...strategyForm, primary })} />
              <ChainEditor label="Secondary Chain" chain={strategyForm.secondary}
                onChange={secondary => setStrategyForm({ ...strategyForm, secondary })} />
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button onClick={() => { setNewStrategy(false); setEditingStrategy(null); }}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveStrategy}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm transition-colors">
                  {newStrategy ? 'Create' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execution Mode Create/Edit Modal */}
      {(newMode || editingMode) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { setNewMode(false); setEditingMode(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-auto border border-gray-200/50"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {newMode ? 'New Execution Mode' : `Edit Mode: ${editingMode?.label}`}
              </h3>
              <button onClick={() => { setNewMode(false); setEditingMode(null); }}
                className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID <span className="text-red-500">*</span></label>
                  <input type="text" value={modeForm.id}
                    onChange={e => setModeForm({ ...modeForm, id: e.target.value })}
                    disabled={!!editingMode}
                    autoFocus={!editingMode}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm disabled:bg-gray-100"
                    placeholder="e.g. custom-mode"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Label <span className="text-red-500">*</span></label>
                  <input type="text" value={modeForm.label}
                    onChange={e => setModeForm({ ...modeForm, label: e.target.value })}
                    autoFocus={!!editingMode}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                  <input type="text" value={modeForm.icon}
                    onChange={e => setModeForm({ ...modeForm, icon: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
                    placeholder="emoji"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={modeForm.description}
                  onChange={e => setModeForm({ ...modeForm, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prefill Provider</label>
                  <select value={modeForm.prefill.tool}
                    onChange={e => setModeForm({ ...modeForm, prefill: { ...modeForm.prefill, tool: e.target.value, agentMode: '' } })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm">
                    <option value="">None (strategy default)</option>
                    {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prefill Model</label>
                  <select value={modeForm.prefill.agentMode}
                    onChange={e => setModeForm({ ...modeForm, prefill: { ...modeForm.prefill, agentMode: e.target.value } })}
                    disabled={!modeForm.prefill.tool}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm disabled:bg-gray-100">
                    <option value="">auto</option>
                    {modeForm.prefill.tool && (PROVIDER_MODELS[modeForm.prefill.tool] || []).map(m =>
                      <option key={m} value={m}>{m}</option>
                    )}
                  </select>
                </div>
              </div>
              <ChainEditor label="Primary Chain" chain={modeForm.primary}
                onChange={primary => setModeForm({ ...modeForm, primary })} />
              <ChainEditor label="Secondary Chain" chain={modeForm.secondary}
                onChange={secondary => setModeForm({ ...modeForm, secondary })} />
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button onClick={() => { setNewMode(false); setEditingMode(null); }}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveMode}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm transition-colors">
                  {newMode ? 'Create' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteConfirm.open}
        title={`Delete ${deleteConfirm.type === 'strategy' ? 'Strategy' : 'Execution Mode'}`}
        message={`Are you sure you want to delete "${deleteConfirm.label}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={deleteConfirm.type === 'strategy' ? handleDeleteStrategy : handleDeleteMode}
        onCancel={() => setDeleteConfirm({ open: false, type: '', id: '', label: '' })}
      />
    </div>
  );
}
