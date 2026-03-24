# 05a — Circuit Breaker & Failure Classification

## Source Files
- `crates/arc-providers/src/breaker.rs` — CircuitBreaker
- `crates/arc-providers/src/fallback.rs` — FallbackPolicy, FailureKind

## Circuit Breaker (3-State Machine)

```
Closed → (N failures) → Open → (cooldown elapsed) → HalfOpen → (probe succeeds) → Closed
                                                              → (probe fails) → Open
```

```typescript
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failureCount = 0;
  private lastFailure: number | null = null;

  constructor(
    private failureThreshold: number = 3,
    private cooldownMs: number = 60_000,
  ) {}

  isAllowed(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure! > this.cooldownMs) {
        this.state = 'half_open';
        return true;  // allow one probe request
      }
      return false;
    }
    return false;  // half_open, already probing
  }

  recordSuccess(): void {
    this.state = 'closed';
    this.failureCount = 0;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailure = Date.now();
    if (this.failureCount >= this.failureThreshold)
      this.state = 'open';
  }
}
```

## Failure Classification

```typescript
type FailureKind = 'quota' | 'capacity' | 'transient' | 'unknown';

function classifyFailure(statusCode: number, message: string): FailureKind {
  if (statusCode === 429) return 'quota';
  if (statusCode === 503 || statusCode === 502) return 'capacity';
  if (/timeout|ECONNRESET|ETIMEDOUT/i.test(message)) return 'transient';
  return 'unknown';
}
```

## Fallback Intent Resolution

```typescript
type FallbackIntent =
  | 'retry_always'
  | 'retry_once'
  | 'stop'
  | 'retry_later'
  | 'upgrade';

interface FallbackPolicy {
  model: string;
  isLastResort: boolean;
  actionOnQuota: FallbackIntent;
  actionOnCapacity: FallbackIntent;
  actionOnTransient: FallbackIntent;
}
```

## Connectivity State

```typescript
type ConnectivityState =
  | { state: 'online' }
  | { state: 'degraded'; reachable: string[] }
  | { state: 'offline' };
```

## Acceptance Criteria

- [ ] Circuit breaker with 3 states per provider
- [ ] Failure classification from HTTP status + error message
- [ ] Fallback intent resolves to retry/stop/upgrade action
- [ ] Connectivity state tracked across providers
