import {
  slugify,
  truncate,
  randomString,
  capitalize,
  toTitleCase,
} from './string.utils';

describe('string.utils', () => {
  describe('slugify', () => {
    it('should convert to lowercase', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should replace spaces with hyphens', () => {
      expect(slugify('foo bar baz')).toBe('foo-bar-baz');
    });

    it('should remove non-word chars', () => {
      expect(slugify('hello!@#$world')).toBe('helloworld');
    });

    it('should collapse multiple hyphens', () => {
      expect(slugify('foo---bar')).toBe('foo-bar');
    });

    it('should trim leading/trailing hyphens', () => {
      expect(slugify('  hello world  ')).toBe('hello-world');
    });
  });

  describe('truncate', () => {
    it('should return full text when within length', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('should truncate with default ellipsis', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
    });

    it('should use custom suffix', () => {
      expect(truncate('hello world', 8, '…')).toBe('hello w…');
    });
  });

  describe('randomString', () => {
    it('should return requested length', () => {
      const result = randomString(10);
      expect(result).toHaveLength(10);
    });

    it('should return alphanumeric chars only', () => {
      const result = randomString(100);
      expect(result).toMatch(/^[A-Za-z0-9]+$/);
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });
  });

  describe('toTitleCase', () => {
    it('should capitalize each word', () => {
      expect(toTitleCase('hello world')).toBe('Hello World');
    });
  });
});
