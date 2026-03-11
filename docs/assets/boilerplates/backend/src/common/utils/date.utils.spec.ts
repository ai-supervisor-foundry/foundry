import {
  startOfDay,
  endOfDay,
  addDays,
  addHours,
  daysDifference,
  formatDuration,
  isToday,
  toDateString,
} from './date.utils';

describe('date.utils', () => {
  describe('startOfDay', () => {
    it('should set time to 00:00:00.000', () => {
      const d = new Date('2026-03-03T14:30:45.123');
      const result = startOfDay(d);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should not mutate the original date', () => {
      const d = new Date('2026-03-03T14:30:45');
      startOfDay(d);
      expect(d.getHours()).toBe(14);
    });
  });

  describe('endOfDay', () => {
    it('should set time to 23:59:59.999', () => {
      const d = new Date('2026-03-03T08:00:00');
      const result = endOfDay(d);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      const d = new Date('2026-03-03');
      const result = addDays(d, 5);
      expect(result.getDate()).toBe(8);
    });

    it('should subtract when days is negative', () => {
      const d = new Date('2026-03-10');
      const result = addDays(d, -3);
      expect(result.getDate()).toBe(7);
    });
  });

  describe('addHours', () => {
    it('should add hours', () => {
      const d = new Date('2026-03-03T10:00:00');
      const result = addHours(d, 5);
      expect(result.getHours()).toBe(15);
    });
  });

  describe('daysDifference', () => {
    it('should return absolute difference in days', () => {
      const d1 = new Date('2026-03-03');
      const d2 = new Date('2026-03-08');
      expect(daysDifference(d1, d2)).toBe(5);
      expect(daysDifference(d2, d1)).toBe(5);
    });
  });

  describe('formatDuration', () => {
    it('should format days and hours', () => {
      expect(formatDuration(25 * 60 * 60 * 1000)).toBe('1d 1h');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(90 * 60 * 1000)).toBe('1h 30m');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90 * 1000)).toBe('1m 30s');
    });

    it('should format seconds only', () => {
      expect(formatDuration(5000)).toBe('5s');
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      expect(isToday(new Date())).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);
    });
  });

  describe('toDateString', () => {
    it('should return YYYY-MM-DD format', () => {
      const d = new Date('2026-03-03T14:30:00');
      expect(toDateString(d)).toBe('2026-03-03');
    });
  });
});
