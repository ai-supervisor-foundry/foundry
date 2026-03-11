import { Project, Timesheet, TimesheetStatus, HoursReportRow } from '../types';
import { addDays, format, parseISO } from 'date-fns';

// Initial Mock Data
const PROJECTS: Project[] = [
  {
    id: 'p1',
    code: 'TM-001',
    description: 'Tradymate Implementation',
    defaultTask: 'Implementation',
    startDate: '2024-01-01',
    endDate: '2025-12-31',
    status: 'active'
  },
  {
    id: 'p2',
    code: 'TM-002',
    description: 'Tradymate Support',
    defaultTask: 'Support',
    startDate: '2024-06-01',
    endDate: '2025-06-01',
    status: 'active'
  },
  {
    id: 'p3',
    code: 'IR-001',
    description: 'Internal Review',
    defaultTask: 'Audit',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    status: 'active'
  }
];

const MOCK_USER_NAMES: Record<string, string> = { u1: 'User One', u2: 'User Two' };

const TIMESHEETS: Timesheet[] = [
  {
    id: 'TM00001',
    userId: 'u1',
    weekStartDate: '2024-12-30',
    weekEndDate: '2025-01-05',
    status: TimesheetStatus.PENDING,
    comments: 'Completed implementation phase 1.',
    totalHours: 40,
    rows: [
      {
        id: 'r1',
        projectId: 'p1',
        taskName: 'Implementation',
        hours: { mon: 8, tue: 8, wed: 8, thu: 8, fri: 8, sat: 0, sun: 0 }
      }
    ]
  },
  {
    id: 'TM00002',
    userId: 'u1',
    weekStartDate: '2025-01-06',
    weekEndDate: '2025-01-12',
    status: TimesheetStatus.APPROVED,
    comments: 'Support tasks handled smoothly.',
    totalHours: 40,
    rows: [
      {
        id: 'r2',
        projectId: 'p2',
        taskName: 'Support',
        hours: { mon: 8, tue: 8, wed: 8, thu: 8, fri: 8, sat: 0, sun: 0 }
      }
    ]
  },
  {
    id: 'TM00003',
    userId: 'u1',
    weekStartDate: '2025-01-13',
    weekEndDate: '2025-01-19',
    status: TimesheetStatus.DRAFT,
    comments: '',
    totalHours: 32,
    rows: [
      {
        id: 'r3',
        projectId: 'p1',
        taskName: 'Implementation',
        hours: { mon: 8, tue: 8, wed: 8, thu: 8, fri: 0, sat: 0, sun: 0 }
      }
    ]
  },
  {
    id: 'TM00004',
    userId: 'u2',
    weekStartDate: '2025-01-06',
    weekEndDate: '2025-01-12',
    status: TimesheetStatus.APPROVED,
    comments: '',
    totalHours: 40,
    rows: [
      {
        id: 'r4',
        projectId: 'p2',
        taskName: 'Support',
        hours: { mon: 8, tue: 8, wed: 8, thu: 8, fri: 8, sat: 0, sun: 0 }
      }
    ]
  }
];

// Helper to simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const MockService = {
  getProjects: async (): Promise<Project[]> => {
    await delay(300);
    return [...PROJECTS];
  },

  addProject: async (project: Omit<Project, 'id'>): Promise<Project> => {
    await delay(300);
    const newProject = { ...project, id: `p${Date.now()}` };
    PROJECTS.push(newProject);
    return newProject;
  },

  updateProject: async (id: string, updates: Partial<Project>): Promise<Project> => {
    await delay(300);
    const idx = PROJECTS.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Project not found');
    PROJECTS[idx] = { ...PROJECTS[idx], ...updates };
    return PROJECTS[idx];
  },

  deleteProject: async (id: string): Promise<void> => {
    await delay(300);
    const idx = PROJECTS.findIndex((p) => p.id === id);
    if (idx !== -1) PROJECTS.splice(idx, 1);
  },

  getTimesheets: async (userId: string): Promise<Timesheet[]> => {
    await delay(300);
    return TIMESHEETS.filter(t => t.userId === userId).sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime());
  },

  getTimesheetById: async (id: string): Promise<Timesheet | undefined> => {
    await delay(200);
    return TIMESHEETS.find(t => t.id === id);
  },

  createTimesheet: async (userId: string, weekStartDate: string): Promise<Timesheet> => {
    await delay(400);
    const weekStart = new Date(weekStartDate);
    const weekEnd = addDays(weekStart, 6);
    
    const newTimesheet: Timesheet = {
      id: `TM${(TIMESHEETS.length + 1).toString().padStart(5, '0')}`,
      userId,
      weekStartDate: format(weekStart, 'yyyy-MM-dd'),
      weekEndDate: format(weekEnd, 'yyyy-MM-dd'),
      status: TimesheetStatus.DRAFT,
      rows: [],
      comments: '',
      totalHours: 0
    };
    TIMESHEETS.push(newTimesheet);
    return newTimesheet;
  },

  updateTimesheet: async (updatedTimesheet: Timesheet): Promise<Timesheet> => {
    await delay(400);
    const index = TIMESHEETS.findIndex(t => t.id === updatedTimesheet.id);
    if (index !== -1) {
      TIMESHEETS[index] = updatedTimesheet;
    }
    return updatedTimesheet;
  },

  deleteTimesheet: async (id: string): Promise<void> => {
    await delay(300);
    const index = TIMESHEETS.findIndex(t => t.id === id);
    if (index !== -1) {
      TIMESHEETS.splice(index, 1);
    }
  },

  approve: async (id: string): Promise<void> => {
    await delay(300);
    const t = TIMESHEETS.find(x => x.id === id);
    if (t) t.status = TimesheetStatus.APPROVED;
  },

  reject: async (id: string, comment: string): Promise<void> => {
    await delay(300);
    const t = TIMESHEETS.find(x => x.id === id);
    if (t) {
      t.status = TimesheetStatus.DRAFT;
      t.rejectionComment = comment;
    }
  },

  getHoursReport: async (fromDate: string, toDate: string): Promise<HoursReportRow[]> => {
    await delay(300);
    const from = parseISO(fromDate);
    const to = parseISO(toDate);
    const inRange = TIMESHEETS.filter((t) => {
      const start = parseISO(t.weekStartDate);
      const end = parseISO(t.weekEndDate);
      return start <= to && end >= from;
    });
    const weekLabels: string[] = [];
    const weekSet = new Set<string>();
    inRange.forEach((t) => {
      if (!weekSet.has(t.weekStartDate)) {
        weekSet.add(t.weekStartDate);
        weekLabels.push(t.weekStartDate);
      }
    });
    weekLabels.sort();
    type Acc = { totalHours: number; byWeek: Record<string, number> };
    const acc = new Map<string, Acc>();
    const projectNames = new Map(PROJECTS.map((p) => [p.id, p.description]));
    inRange.forEach((t) => {
      const weekLabel = format(parseISO(t.weekStartDate), 'yyyy-MM-dd');
      t.rows.forEach((row) => {
        const rowTotal = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).reduce((s, d) => s + (row.hours[d] ?? 0), 0);
        const key = `${t.userId}|${row.projectId}`;
        let v = acc.get(key);
        if (!v) {
          v = { totalHours: 0, byWeek: {} };
          weekLabels.forEach((w) => (v!.byWeek[w] = 0));
          acc.set(key, v);
        }
        v.totalHours += rowTotal;
        v.byWeek[weekLabel] = (v.byWeek[weekLabel] ?? 0) + rowTotal;
      });
    });
    const rows: HoursReportRow[] = [];
    acc.forEach((v, key) => {
      const [userId, projectId] = key.split('|');
      rows.push({
        userId,
        userName: MOCK_USER_NAMES[userId] ?? userId,
        projectId,
        projectName: projectNames.get(projectId) ?? projectId,
        totalHours: v.totalHours,
        weekBreakdown: weekLabels.map((w) => ({ weekLabel: w, hours: v.byWeek[w] ?? 0 })),
      });
    });
    rows.sort((a, b) => a.userName.localeCompare(b.userName) || a.projectName.localeCompare(b.projectName));
    return rows;
  },
};