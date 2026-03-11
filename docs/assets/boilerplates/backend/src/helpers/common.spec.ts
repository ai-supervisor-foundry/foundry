import { promiseTimeout } from './common';

describe('Common Helpers', () => {
  describe('promiseTimeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should resolve after specified timeout', async () => {
      const promise = promiseTimeout(1000);

      jest.advanceTimersByTime(1000);

      await expect(promise).resolves.toBeNull();
    });

    it('should call callback function when provided', async () => {
      const callback = jest.fn();
      const promise = promiseTimeout(1000, callback);

      jest.advanceTimersByTime(1000);

      await expect(promise).resolves.toBeNull();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not call callback when not provided', async () => {
      const promise = promiseTimeout(1000);

      jest.advanceTimersByTime(1000);

      await expect(promise).resolves.toBeNull();
    });

    it('should handle different timeout values', async () => {
      const promise1 = promiseTimeout(500);
      const promise2 = promiseTimeout(2000);

      jest.advanceTimersByTime(500);
      await expect(promise1).resolves.toBeNull();

      jest.advanceTimersByTime(1500);
      await expect(promise2).resolves.toBeNull();
    });

    it('should handle callback with parameters', async () => {
      const callback = jest.fn((param: string) => param);
      const promise = promiseTimeout(1000, () => callback('test'));

      jest.advanceTimersByTime(1000);

      await expect(promise).resolves.toBeNull();
      expect(callback).toHaveBeenCalledWith('test');
    });

    it('should handle zero timeout', async () => {
      const promise = promiseTimeout(0);

      jest.advanceTimersByTime(0);

      await expect(promise).resolves.toBeNull();
    });
  });
});
