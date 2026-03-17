---
description: Provider resource_exhausted error handling and exponential backoff
---

# Resource Exhaustion Handling

When a CLI provider (e.g., Cursor) returns `ConnectError: [resource_exhausted]`:

1. **Backoff Strategy**:
   - 1 minute
   - 5 minutes
   - 20 minutes
   - 1 hour
   - 2 hours
   - Then complete halt

2. **State Tracking**:
   - Tracks attempt number, last attempt time, next retry time
   - Stores provider name in state
   - Supervisor sleeps during backoff (longer intervals to reduce CPU cycles)

3. **Circuit Breaker**:
   - Failed provider is circuit-broken for 1 day (TTL in DragonflyDB)
   - Automatic fallback to next provider in priority chain
