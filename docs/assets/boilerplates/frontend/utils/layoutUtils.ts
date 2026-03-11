export function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Home';
  if (pathname.startsWith('/projects')) return 'Projects';
  if (pathname.startsWith('/timesheets')) return pathname === '/timesheets' ? 'Timesheets' : 'Timesheet';
  if (pathname.startsWith('/reports')) return 'Reports';
  if (pathname.startsWith('/users')) return 'Users';
  if (pathname.startsWith('/tasks')) return 'Tasks';
  return 'Home';
}
