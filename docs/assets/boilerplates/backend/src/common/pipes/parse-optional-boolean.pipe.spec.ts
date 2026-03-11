import { ParseOptionalBooleanPipe } from './parse-optional-boolean.pipe';

describe('ParseOptionalBooleanPipe', () => {
  const pipe = new ParseOptionalBooleanPipe();

  it('should return undefined for undefined', () => {
    expect(pipe.transform(undefined, {} as any)).toBeUndefined();
  });

  it('should return undefined for null', () => {
    expect(pipe.transform(null, {} as any)).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    expect(pipe.transform('', {} as any)).toBeUndefined();
  });

  it('should return true for "true"', () => {
    expect(pipe.transform('true', {} as any)).toBe(true);
  });

  it('should return true for "1"', () => {
    expect(pipe.transform('1', {} as any)).toBe(true);
  });

  it('should return false for "false"', () => {
    expect(pipe.transform('false', {} as any)).toBe(false);
  });

  it('should return false for "0"', () => {
    expect(pipe.transform('0', {} as any)).toBe(false);
  });

  it('should return undefined for invalid value', () => {
    expect(pipe.transform('invalid', {} as any)).toBeUndefined();
  });
});
