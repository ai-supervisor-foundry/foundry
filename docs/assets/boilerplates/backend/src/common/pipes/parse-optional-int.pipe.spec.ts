import { ParseOptionalIntPipe } from './parse-optional-int.pipe';

describe('ParseOptionalIntPipe', () => {
  const pipe = new ParseOptionalIntPipe();

  it('should return undefined for undefined', () => {
    expect(pipe.transform(undefined, {} as any)).toBeUndefined();
  });

  it('should return undefined for null', () => {
    expect(pipe.transform(null, {} as any)).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    expect(pipe.transform('', {} as any)).toBeUndefined();
  });

  it('should parse valid integer string', () => {
    expect(pipe.transform('42', {} as any)).toBe(42);
  });

  it('should return undefined for NaN', () => {
    expect(pipe.transform('abc', {} as any)).toBeUndefined();
  });

  it('should parse negative number', () => {
    expect(pipe.transform('-10', {} as any)).toBe(-10);
  });
});
