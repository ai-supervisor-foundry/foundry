import { format, parseISO } from 'date-fns';

/** Display date as DD/MM/YYYY. Pass string (YYYY-MM-DD) or Date. */
export const formatDateDisplay = (dateStr: string | Date): string => {
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return format(d, 'dd/MM/yyyy');
  } catch {
    return String(dateStr);
  }
};

/** Display date as "EEE DD/MM/YYYY" (e.g. Mon 02/03/2026) */
export const formatDateWithDay = (dateStrOrDate: string | Date): string => {
  const d = typeof dateStrOrDate === 'string' ? parseISO(dateStrOrDate) : dateStrOrDate;
  return format(d, 'EEE dd/MM/yyyy');
};
