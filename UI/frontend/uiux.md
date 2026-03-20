---
description: UI/UX baseline patterns and rules for the Foundry frontend dashboard
---

# UI/UX Guidelines

Read `../../supervisor-contexts/CONTEXT.md` first — it indexes all system documentation.

## Baseline Stack

- **React** + **Vite** — SPA, client-side routing via `react-router-dom`
- **Tailwind CSS** — utility-first styling, no component library
- **react-hot-toast** — toast notifications for success/error feedback
- **Axios** — API client (`src/services/api.ts`)

## Layout

- Top nav bar with page links (Layout component)
- Pages render inside `<main>` with max-width container
- Settings page uses a left sidebar for subsection navigation

## Modals

All **Create** and **Edit** operations that involve nested fields (e.g. strategies with provider chains, execution modes with prefill + chains) **must use a modal**, not inline/section expansion at the bottom of a list.

- Use `ConfirmModal` for destructive confirmations (delete, discard changes)
- Create/Edit modals should:
  - Overlay the page with a backdrop
  - Be dismissible via backdrop click or Escape (with discard confirmation if form has content)
  - Contain the full form including nested field editors (chain builders, etc.)
  - Have clear Cancel / Save (or Create) action buttons in the footer

## Toast Notifications

- Success: task created, setting saved, strategy updated, etc.
- Error: validation failures, API errors
- No `alert()` / `confirm()` — use `toast` from `react-hot-toast` and `ConfirmModal`

## Forms

- Required fields marked with red asterisk
- Optional fields have tooltips explaining behavior when empty
- Dropdowns for constrained values (providers, models, strategies)
- Disabled fields show `disabled:bg-gray-100 disabled:cursor-not-allowed`
- Validation errors shown via toast, not inline (current pattern)

## Settings Page Pattern

- Sidebar with subsections (General, Strategies, Execution Modes)
- General: per-field Save button, `.env` override indicator (amber badge, not disabled)
- Strategies / Execution Modes: list view with Edit/Delete actions, built-in items show badge and cannot be deleted
- CRUD via modals for create/edit, ConfirmModal for delete
