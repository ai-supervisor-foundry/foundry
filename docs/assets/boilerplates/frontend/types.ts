export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER'
}

/** Max length for user position (backend and frontend). */
export const USER_POSITION_MAX_LENGTH = 200;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  position?: string | null;
  managerId?: number | null;
  manager?: User | null;
  avatar?: string;
}

export type ProjectAccessType = 'all' | 'restricted';

/** Max length for project code (backend and frontend). */
export const PROJECT_CODE_MAX_LENGTH = 16;

/** Max length for project estimate hours (backend and frontend). */
export const ESTIMATE_HOURS_MAX_LENGTH = 10;

/** Max value for project weekly hours (backend and frontend). */
export const PROJECT_WEEKLY_HOURS_MAX = 999;

export interface Project {
  id: string;
  code: string; // max length 16
  description: string; // char limit 40
  defaultTask: string; // char limit 100 (Default task name or category)
  startDate: string; // ISO Date
  endDate?: string; // ISO Date, optional
  status: 'active' | 'completed' | 'archived';
  estimateHours?: string | null;
  projectWeeklyHours?: number | null;
  maxHoursPerDay?: number | null;
  accessType?: ProjectAccessType;
  allowedUsers?: User[];
}

export interface ProjectTask {
  id: string;
  projectId: number;
  name: string;
  assignees?: User[];
  isBillable?: boolean;
  sortIndex?: number;
  disabled?: boolean;
  comments?: string | null;
}

export enum TimesheetStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

/** Task type for timesheet entry (backend: task_type). */
export type TaskType = 'billable' | 'nonbillable';

// A single row in the timesheet grid (one task)
export interface TimesheetRow {
  id: string;
  projectId: string; // Links to Project
  taskId?: string | null; // ProjectTask id when selected
  taskName: string;
  taskType?: TaskType;
  hours: {
    mon: number;
    tue: number;
    wed: number;
    thu: number;
    fri: number;
    sat: number;
    sun: number;
  };
  comments?: string;
  /** Per-day comments (mon/tue/.../sun), stored as JSON in timesheet.comments */
  dayComments?: Record<string, string>;
}

export interface Timesheet {
  id: string; // TM00001
  userId: string;
  projectId?: string;
  project?: Project;
  weekStartDate: string; // The Monday of the week
  weekEndDate: string; // The Sunday of the week
  status: TimesheetStatus;
  rows?: TimesheetRow[]; // Optional - backend doesn't return this, frontend constructs from entries
  comments?: string; // Overall comments, limit 500
  totalHours?: number; // Computed
  submittedDate?: string;
  rejectionComment?: string; // Set when manager rejects; shown to user
  /** Project manager (or creator) name; from list/overview API, read-only. */
  projectManagerName?: string | null;
  /** User who owns the timesheet; from detail API. */
  user?: User | null;
}

export interface AggregatedTimesheet {
  projectId: number;
  taskId: string;
  weekStartDate: string;
  weekEndDate: string;
  totalHours: number;
  submissionCount: number;
  statuses: string[];
  projectCode: string;
  projectDescription: string;
  taskName: string;
  projectManagerName: string | null;
}

export interface Expense {
  id: string;
  timesheetId: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  receiptUrl?: string;
}

export interface HoursReportRow {
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  totalHours: number;
  weekBreakdown: { weekLabel: string; hours: number }[];
}

export interface TimesheetEntryRow {
  task: string;
  taskType?: TaskType;
  mon: number; tue: number; wed: number; thu: number; fri: number; sat: number; sun: number;
  total: number;
}

export interface TimesheetEntriesWeek {
  week_start: string;
  week_end: string;
  user_name: string;
  project: string;
  position?: string;
  entries: TimesheetEntryRow[];
  week_total: number;
}

export interface PersonPerformanceReport {
  week_columns: string[];
  persons: {
    user_id: number;
    user_name: string;
    weeks: Record<string, number>;
    total: number;
    avg_per_week: number;
  }[];
}

export interface ProjectPerformanceReport {
  week_columns: string[];
  projects: {
    project_id: number;
    project_name: string;
    weeks: Record<string, number>;
    total: number;
    avg_per_week: number;
    contributors: number;
  }[];
}

/** Timesheet from list/detail API with optional nested task (project-week view). */
export interface TimesheetWithTask extends Timesheet {
  taskId?: string | null;
  task?: { id?: string; name?: string } | null;
  comments?: string | null;
}

/** API response for project total hours. */
export interface ProjectTotalHoursResponse {
  totalHours: number;
}

/** Test mock for matchMedia (MediaQueryList-like). */
export interface MatchMediaMock {
  matches: boolean;
  addListener: () => void;
  removeListener: () => void;
  addEventListener: () => void;
  removeEventListener: () => void;
  dispatchEvent: () => boolean;
  media: string;
  onchange: null;
}
