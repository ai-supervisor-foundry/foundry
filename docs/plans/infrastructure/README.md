# Infrastructure — Plan Index

DragonflyDB feature adoption and CLI decomposition.

| # | File | Scope | Status |
|---|------|-------|--------|
| 1 | [01-dragonfly-pubsub-streams.md](./01-dragonfly-pubsub-streams.md) | Pub/sub event bus, streams consumer groups, hashes | **Not started** |
| 2 | [02-cli-refactoring.md](./02-cli-refactoring.md) | Extract `cli.ts` (~1000 lines) into `application/commands/` | **Not started** |

**Note:** Pub/sub would unblock webhooks/takeover/UI event decoupling.
