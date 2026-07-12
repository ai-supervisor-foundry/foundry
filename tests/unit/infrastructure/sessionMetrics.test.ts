import { SessionMetricsCollector } from '../../../src/infrastructure/monitoring/sessionMetrics';

describe('SessionMetricsCollector', () => {
  let collector: SessionMetricsCollector;

  beforeEach(() => {
    collector = new SessionMetricsCollector();
  });

  it('tracks created and reused sessions with reuse rate', () => {
    collector.recordSessionCreated('feat-a');
    collector.recordSessionReused('feat-a');
    collector.recordSessionReused('feat-a');
    collector.recordSessionCreated('feat-b');

    const metrics = collector.getMetrics();
    expect(metrics.totalSessionsCreated).toBe(2);
    expect(metrics.totalSessionsReused).toBe(2);
    expect(metrics.reuseRate).toBe(50);
    expect(metrics.sessionsByFeature['feat-a']).toBe(1);
    expect(metrics.sessionsByFeature['feat-b']).toBe(1);
  });

  it('estimates token savings from reuse and provider cache hits', () => {
    collector.recordSessionReused('feat-a');
    collector.recordProviderUsage(undefined, 4000, true);
    collector.recordProviderUsage({ tokens: 1000, cached: 500 }, 0, false);

    const metrics = collector.getMetrics();
    expect(metrics.estimatedTokenSavings).toBe(1000 + 500);
    expect(metrics.avgCacheHitRate).toBe(50);
  });

  it('computes average session lifespan across features', () => {
    collector.recordSessionCreated('feat-a');
    collector.recordSessionReused('feat-a');
    collector.recordSessionReused('feat-a');
    collector.recordSessionCreated('feat-a');

    const metrics = collector.getMetrics();
    expect(metrics.avgSessionLifespan).toBeCloseTo(2);
  });

  it('formats summary line for periodic logging', () => {
    collector.recordSessionCreated('feat-a');
    collector.recordSessionReused('feat-a');
    collector.recordProviderUsage({ tokens: 100, cached: 40 }, 800, true);

    const line = collector.formatSummaryLine();
    expect(line).toContain('Session Reuse Rate: 50%');
    expect(line).toContain('Avg Cache Hit: 40%');
    expect(line).toContain('Est. Savings:');
    expect(line).toContain('Avg Lifespan:');
  });

  it('reset clears accumulated metrics', () => {
    collector.recordSessionCreated('feat-a');
    collector.reset();

    const metrics = collector.getMetrics();
    expect(metrics.totalSessionsCreated).toBe(0);
    expect(metrics.totalSessionsReused).toBe(0);
    expect(metrics.reuseRate).toBe(0);
  });
});
