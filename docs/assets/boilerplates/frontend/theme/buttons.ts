/**
 * Button theme tokens — single source of truth for TimeMate button styling.
 * Aligns with contexts/frontend-ux.md: Primary=indigo, Secondary=gray, Danger=red.
 */

/** Min touch target (WCAG 2.2) */
export const BUTTON_MIN_HEIGHT = 'min-h-[44px]';

/** Icon button touch target */
export const BUTTON_ICON_SIZE = 'min-h-[44px] min-w-[44px]';

/** Default throttle for buttons (ms) */
export const BUTTON_THROTTLE_MS = 150;

/** Max width for primary/secondary/destructive buttons — prevents over-stretching */
export const BUTTON_MAX_WIDTH = 'max-w-[150px]';

/** Base: transitions, disabled state */
export const BUTTON_BASE =
  'rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 px-4';

/** Primary (indigo) — main CTAs */
export const BUTTON_PRIMARY =
  'bg-indigo-600 hover:bg-indigo-700 text-white';

/** Secondary (gray outline) — cancel, back */
export const BUTTON_SECONDARY =
  'border border-slate-200 text-slate-700 hover:bg-slate-100';

/** Destructive (red) — delete, reject, clear */
export const BUTTON_DESTRUCTIVE =
  'bg-red-600 hover:bg-red-700 text-white';

/** Success (emerald) — approve */
export const BUTTON_SUCCESS =
  'bg-emerald-600 hover:bg-emerald-700 text-white';

/** 3-dot menu trigger (MenuButton) — neutral slate, icon inherits currentColor */
export const MENU_TRIGGER = 'min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors focus:outline-none focus:ring-0';
/** Compact variant for mobile / side panels */
export const MENU_TRIGGER_COMPACT = 'min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors focus:outline-none focus:ring-0';

/** Light dropdown panel (Projects, TimesheetList, Tasks, Layout FAB) */
export const MENU_ITEMS_PANEL = 'z-50 rounded-lg bg-white border border-slate-200 shadow-xl p-2 focus:outline-none';
/** Dark dropdown panel (Layout sidebar) */
export const MENU_ITEMS_PANEL_DARK = 'z-50 rounded-lg bg-slate-800 border border-slate-700 shadow-xl p-1 focus:outline-none';

/** MenuItem (GhostButton) — flex layout for icon + text */
export const MENU_ITEM = 'flex items-center w-full justify-start gap-2 border-none font-normal px-3 py-2 rounded-md hover:no-underline hover:bg-slate-100 transition-colors';

/** Icon button variants */
export const BUTTON_ICON_VARIANTS = {
  default: 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50',
  ghost: 'text-slate-400 hover:text-slate-600',
  danger: 'text-red-700 hover:bg-red-50',
  success: 'text-emerald-700 hover:bg-emerald-50',
} as const;

/** Ghost (text-link) variants */
export const BUTTON_GHOST_VARIANTS = {
  default: 'text-indigo-600 hover:underline',
  danger: 'text-red-600 hover:underline hover:text-red-700',
  success: 'text-emerald-600 hover:underline',
} as const;

/** Width presets */
export const BUTTON_WIDTH = {
  auto: 'w-auto',
  /** Standalone CTAs (Add task, New Project, etc.) — fixed 200px */
  cta: 'w-[200px]',
  /** Form/save buttons (Dashboard, TimesheetEditor) — 150px */
  ctaSmall: 'w-[150px]',
  full: 'w-full max-w-full',
  max: `w-auto ${BUTTON_MAX_WIDTH}`,
  /** For flex rows — use instead of full when parent is flex */
  flex: 'flex-1 min-w-0',
} as const;
