import * as fs from 'fs/promises';
import * as path from 'path';
import { log as logShared } from '../adapters/logging/logger';

export interface SessionMetrics {
  totalSessionsCreated: number;
  totalSessionsReused: number;
  reuseRate: number;
  estimatedTokenSavings: number;
  avgSessionLifespan: number;
  avgCacheHitRate: number;
  sessionsByFeature: Record<string, number>;
}

export interface ProviderUsage {
  tokens?: number;
  cached?: number;
}

export class SessionMetricsCollector {
  private totalSessionsCreated = 0;
  private totalSessionsReused = 0;
  private estimatedTokenSavings = 0;
  private sessionLifespans: number[] = [];
  private cacheHitRates: number[] = [];
  private sessionsByFeature: Record<string, number> = {};
  private featureSessionIterations = new Map<string, number>();

  recordSessionCreated(featureId: string): void {
    const prev = this.featureSessionIterations.get(featureId);
    if (prev !== undefined && prev > 0) {
      this.sessionLifespans.push(prev);
    }
    this.featureSessionIterations.set(featureId, 1);
    this.totalSessionsCreated++;
    this.sessionsByFeature[featureId] = (this.sessionsByFeature[featureId] || 0) + 1;
  }

  recordSessionReused(featureId: string): void {
    this.totalSessionsReused++;
    const current = this.featureSessionIterations.get(featureId) || 0;
    this.featureSessionIterations.set(featureId, current + 1);
  }

  recordProviderUsage(
    usage: ProviderUsage | undefined,
    promptChars: number,
    wasReused: boolean
  ): void {
    if (wasReused && promptChars > 0) {
      this.estimatedTokenSavings += Math.floor(promptChars / 4);
    }
    if (usage?.cached != null && usage.tokens != null && usage.tokens > 0) {
      this.cacheHitRates.push((usage.cached / usage.tokens) * 100);
      this.estimatedTokenSavings += usage.cached;
    }
  }

  getMetrics(): SessionMetrics {
    const lifespans = [...this.sessionLifespans, ...this.featureSessionIterations.values()];
    const avgSessionLifespan =
      lifespans.length > 0
        ? lifespans.reduce((sum, n) => sum + n, 0) / lifespans.length
        : 0;
    const total = this.totalSessionsCreated + this.totalSessionsReused;
    const reuseRate = total > 0 ? (this.totalSessionsReused / total) * 100 : 0;
    const avgCacheHitRate =
      this.cacheHitRates.length > 0
        ? this.cacheHitRates.reduce((sum, n) => sum + n, 0) / this.cacheHitRates.length
        : 0;

    return {
      totalSessionsCreated: this.totalSessionsCreated,
      totalSessionsReused: this.totalSessionsReused,
      reuseRate,
      estimatedTokenSavings: this.estimatedTokenSavings,
      avgSessionLifespan,
      avgCacheHitRate,
      sessionsByFeature: { ...this.sessionsByFeature },
    };
  }

  formatSummaryLine(): string {
    const m = this.getMetrics();
    const savings =
      m.estimatedTokenSavings >= 1_000_000
        ? `${(m.estimatedTokenSavings / 1_000_000).toFixed(1)}M`
        : m.estimatedTokenSavings >= 1_000
          ? `${(m.estimatedTokenSavings / 1_000).toFixed(1)}K`
          : String(m.estimatedTokenSavings);
    const cachePart =
      m.avgCacheHitRate > 0 ? ` | Avg Cache Hit: ${m.avgCacheHitRate.toFixed(0)}%` : '';
    return `[Metrics] Session Reuse Rate: ${m.reuseRate.toFixed(0)}%${cachePart} | Est. Savings: ${savings} Tokens | Avg Lifespan: ${m.avgSessionLifespan.toFixed(1)} iter`;
  }

  logSummary(): void {
    logShared('Metrics', this.formatSummaryLine());
  }

  async persist(sandboxRoot: string, projectId: string): Promise<void> {
    try {
      const dir = path.join(sandboxRoot, projectId);
      await fs.mkdir(dir, { recursive: true });
      const payload = {
        ...this.getMetrics(),
        updated_at: new Date().toISOString(),
      };
      await fs.writeFile(path.join(dir, 'session-metrics.json'), JSON.stringify(payload, null, 2));
    } catch {
      // Non-fatal: observability only
    }
  }

  reset(): void {
    this.totalSessionsCreated = 0;
    this.totalSessionsReused = 0;
    this.estimatedTokenSavings = 0;
    this.sessionLifespans = [];
    this.cacheHitRates = [];
    this.sessionsByFeature = {};
    this.featureSessionIterations.clear();
  }
}

export const sessionMetrics = new SessionMetricsCollector();
