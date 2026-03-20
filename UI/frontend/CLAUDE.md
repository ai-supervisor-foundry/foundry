---
project: Foundry — UI Frontend Dashboard
scope: React dashboard for supervisor state visualization and control
---

# Foundry UI/frontend/ — Agent Instructions

Read `../../supervisor-contexts/CONTEXT.md` first — it indexes all system documentation.

## Key Sections

- State schema: `../../supervisor-contexts/state-management.md`
- Task schema: `../../supervisor-contexts/task-schema.md`
- Configuration: `../../supervisor-contexts/configuration.md`
- Logging & auditability: `../../supervisor-contexts/logging-auditability.md`
- UI/UX guidelines: [`uiux.md`](uiux.md)

## Structure

- `src/pages/` — Tasks (task CRUD, bulk select/delete, add form with execution mode sidebar, duplicate), Dashboard, Projects, Logs, CommandExecutor, StateInspector, LocalProvider, Settings (sidebar: General settings, Strategies CRUD, Execution Modes CRUD; all with duplicate-to-create)
- `src/components/` — TaskCard (expand, edit, duplicate), StatusBadge, Layout (Foundry nav, indigo theme), AutoRefresh, ChatVisualizer (color-coded: blue=prompt, green=response, yellow=fix, purple=interrogation), LogViewer, ConfirmModal (reusable confirm/cancel modal, rounded-2xl backdrop-blur)
- `src/utils/` — Pure helpers extracted for testability: `chatParsing.ts` (section extraction, preview generation, agent response preview with JSON block stripping)
- `src/services/api.ts` — Axios API client (state, tasks, logs, commands, config, settings, strategies CRUD, execution-modes CRUD, preferences, projects, ollama)
- `src/constants/providers/models.ts` — Provider-to-model mapping for agent mode dropdowns
- `src/constants/executionModes.ts` — ExecutionMode + Strategy types + fallback; data fetched from Postgres via API
- `App.tsx` — react-hot-toast `<Toaster>` provider for toast notifications

## Navigation

Parent: [`UI/CLAUDE.md`](../CLAUDE.md)

## Routing

- Logs page uses `useSearchParams` for tab + project persistence (`?tab=chat&project=dummy`)
- Settings page uses `useSearchParams` for section persistence (`?section=execution-modes`)

## Theme

- Indigo accent (nav, buttons, tabs, sidebar active, focus rings), emerald for create/add actions, slate-50 body
- Cards: `rounded-xl border border-gray-200 shadow-sm`, modals: `rounded-2xl shadow-2xl backdrop-blur-sm`
- Focus: `focus-visible` (keyboard only, not mouse clicks) with indigo ring
- Inputs: `rounded-lg border-gray-200 shadow-sm`, buttons: `rounded-lg transition-colors`
- Reference: `sandbox/**/design-system/` for styling patterns (tokens, WCAG touch targets)

## Testing

- **Vitest** for pure utility tests (`src/utils/*.test.ts`). Run: `npx vitest run`
- No DOM/component tests yet (no jsdom/@testing-library)

## Behavioral Rules

Be concise. Propose = suggest only. Max 6 line changes. Verify approval before commands. Questions = answer only. Mistakes = halt.
