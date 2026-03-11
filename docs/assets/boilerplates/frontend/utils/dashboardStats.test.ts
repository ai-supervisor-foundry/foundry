import { describe, it, expect } from 'vitest';
import {
  getCurrentWeekStart,
  getHoursThisWeek,
  getCounts,
  getChartDataLast5Weeks,
  getRecentTimesheets,
} from './dashboardStats';
import { Timesheet, TimesheetStatus } from '../types';

const mockTimesheets: Timesheet[] = [
  {
    id: 'TM00001',
    userId: 'u1',
    weekStartDate: '2025-02-10',
    weekEndDate: '2025-02-16',
    status: TimesheetStatus.PENDING,
    comments: '',
    totalHours: 40,
    rows: [],
  },
  {
    id: 'TM00002',
    userId: 'u1',
    weekStartDate: '2025-02-03',
    weekEndDate: '2025-02-09',
    status: TimesheetStatus.APPROVED,
    comments: '',
    totalHours: 38,
    rows: [],
  },
  {
    id: 'TM00003',
    userId: 'u1',
    weekStartDate: '2025-01-27',
    weekEndDate: '2025-02-02',
    status: TimesheetStatus.DRAFT,
    comments: '',
    totalHours: 32,
    rows: [],
  },
];

describe('dashboardStats', () => {
  it('getCurrentWeekStart returns Monday in yyyy-MM-dd', () => {
    const d = new Date('2025-02-20');
    const weekStart = getCurrentWeekStart(d);
    expect(weekStart).toBe('2025-02-17');
  });

  it('getHoursThisWeek returns hours when timesheet exists for current week', () => {
    const weekStart = '2025-02-10';
    expect(getHoursThisWeek(mockTimesheets, weekStart)).toBe(40);
  });

  it('getHoursThisWeek returns 0 when no timesheet for week', () => {
    expect(getHoursThisWeek(mockTimesheets, '2025-03-01')).toBe(0);
  });

  it('getCounts returns correct pending/approved/draft from mock data', () => {
    const counts = getCounts(mockTimesheets);
    expect(counts.pending).toBe(1);
    expect(counts.approved).toBe(1);
    expect(counts.draft).toBe(1);
  });

  it('getChartDataLast5Weeks returns 5 points with hours or zero', () => {
    const chart = getChartDataLast5Weeks(mockTimesheets, new Date('2025-02-20'));
    expect(chart).toHaveLength(5);
    expect(chart.every((p) => typeof p.hours === 'number' && p.name.length > 0)).toBe(true);
  });

  it('getRecentTimesheets returns at most n items', () => {
    const recent = getRecentTimesheets(mockTimesheets, 5);
    expect(recent).toHaveLength(3);
    const recent5 = getRecentTimesheets([...mockTimesheets, ...mockTimesheets], 5);
    expect(recent5).toHaveLength(5);
  });
});
