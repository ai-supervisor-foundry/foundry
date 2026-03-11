import { Timesheet, TimesheetStatus } from '../types';
import { format, startOfWeek, subWeeks } from 'date-fns';
import { formatDateDisplay } from './dateUtils';

export interface WeekChartPoint {
  name: string;
  hours: number;
  status: TimesheetStatus | null;
}

export function getCurrentWeekStart(today: Date = new Date()): string {
  return format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export function getHoursThisWeek(timesheets: Timesheet[], currentWeekStart: string): number {
  const t = timesheets.find((ts) => ts.weekStartDate === currentWeekStart);
  return t ? t.totalHours : 0;
}

export function getCounts(timesheets: Timesheet[]): {
  pending: number;
  approved: number;
  draft: number;
} {
  return {
    pending: timesheets.filter((t) => t.status === TimesheetStatus.PENDING).length,
    approved: timesheets.filter((t) => t.status === TimesheetStatus.APPROVED).length,
    draft: timesheets.filter((t) => t.status === TimesheetStatus.DRAFT).length,
  };
}

export function getChartDataLast5Weeks(
  timesheets: Timesheet[],
  today: Date = new Date()
): WeekChartPoint[] {
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const last5WeekStarts = [0, 1, 2, 3, 4].map((i) =>
    format(subWeeks(weekStart, 4 - i), 'yyyy-MM-dd')
  );
  return last5WeekStarts.map((weekStart) => {
    const t = timesheets.find((ts) => ts.weekStartDate === weekStart);
    return {
      name: formatDateDisplay(weekStart),
      hours: t ? t.totalHours : 0,
      status: t?.status ?? null,
    };
  });
}

export function getRecentTimesheets(timesheets: Timesheet[], n: number): Timesheet[] {
  return timesheets.slice(0, n);
}
