import { Audit } from './custom.base.entity';

describe('Audit Entity', () => {
  let audit: Audit;

  beforeEach(() => {
    audit = new Audit();
  });

  it('should be defined', () => {
    expect(audit).toBeDefined();
  });

  it('should be an instance of Audit', () => {
    expect(audit).toBeInstanceOf(Audit);
  });

  it('should have the correct class structure', () => {
    expect(typeof audit).toBe('object');
    expect(audit.constructor.name).toBe('Audit');
  });
});
