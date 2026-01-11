# Foundry Functional Testing Plan

## Overview

This plan outlines the comprehensive functional testing strategy for Foundry, focusing on scenario-based testing with complete external service mocking. The goal is to create deterministic, isolated, and maintainable tests that validate real-world workflows without external dependencies.

## Objectives

1. **Comprehensive Coverage**: Test all critical workflows and edge cases
2. **Zero External Dependencies**: Mock all external services (Redis, providers, file system, executors)
3. **Deterministic Execution**: Tests produce identical results on every run
4. **Fast Execution**: Complete test suite runs in under 30 seconds
5. **Maintainable**: Clear structure, easy to extend with new scenarios
6. **Production-Ready**: Validate against actual operator workflows

## Current State Analysis

### Existing Dependencies
- **State Storage**: `ioredis` (^5.3.2) for DragonflyDB/Redis
- **CLI Framework**: `commander` (^11.1.0)
- **AST Processing**: `ts-morph` (^27.0.2)
- **AI Providers**: @github/copilot, ollama
- **Testing**: jest (^29.7.0), ts-jest, jest-mock-extended

### External Services Requiring Mocks
1. **Redis/DragonflyDB**: State persistence and queue operations
2. **Provider CLIs**: Gemini, Copilot, Cursor, Claude, Codex, Ollama
3. **File System**: Sandbox operations, log files, project files
4. **Process Execution**: child_process exec/spawn for verification commands
5. **Network**: Circuit breaker state management

### Current Testing Gaps
- No functional/scenario-based tests
- Limited mocking infrastructure
- No end-to-end workflow validation
- Provider CLI interactions untested
- State persistence/recovery untested
- Queue operations lack integration tests

## Test Structure

```
tests/
├── unit/                                    # Existing unit tests
│   ├── domain/                              
│   ├── application/                         
│   └── infrastructure/                      
│
├── functional/                              # NEW: Scenario-based tests
│   ├── scenarios/
│   │   ├── control-loop/                    # State machine & iterations
│   │   │   ├── happy-path.test.ts
│   │   │   ├── state-transitions.test.ts
│   │   │   └── iteration-tracking.test.ts
│   │   │
│   │   ├── task-lifecycle/                  # Task processing flows
│   │   │   ├── dispatch-execute-complete.test.ts
│   │   │   ├── validation-retry.test.ts
│   │   │   ├── blocking-scenarios.test.ts
│   │   │   └── task-metadata-preservation.test.ts
│   │   │
│   │   ├── provider-management/             # Provider interactions
│   │   │   ├── provider-fallback.test.ts
│   │   │   ├── circuit-breaker.test.ts
│   │   │   ├── quota-errors.test.ts
│   │   │   └── provider-priority.test.ts
│   │   │
│   │   ├── persistence/                     # State & recovery
│   │   │   ├── crash-recovery.test.ts
│   │   │   ├── state-reload.test.ts
│   │   │   ├── incremental-persistence.test.ts
│   │   │   └── corruption-handling.test.ts
│   │   │
│   │   ├── validation/                      # Deterministic validation
│   │   │   ├── ambiguity-detection.test.ts
│   │   │   ├── criteria-matching.test.ts
│   │   │   ├── ast-validation.test.ts
│   │   │   └── behavioral-validation.test.ts
│   │   │
│   │   ├── queue-operations/                # Task queue management
│   │   │   ├── queue-exhaustion.test.ts
│   │   │   ├── task-dequeue.test.ts
│   │   │   ├── queue-refill.test.ts
│   │   │   └── queue-persistence.test.ts
│   │   │
│   │   └── execution-modes/                 # AUTO/MANUAL modes
│   │       ├── auto-mode-flow.test.ts
│   │       ├── manual-intervention.test.ts
│   │       ├── mode-transitions.test.ts
│   │       └── halt-resume.test.ts
│   │
│   └── fixtures/
│       ├── tasks/                           # Task definitions by type
│       │   ├── coding-tasks.ts
│       │   ├── behavioral-tasks.ts
│       │   └── complex-tasks.ts
│       ├── states/                          # State snapshots
│       │   ├── initial-states.ts
│       │   ├── intermediate-states.ts
│       │   └── terminal-states.ts
│       ├── provider-responses/              # Expected provider outputs
│       │   ├── gemini-responses.ts
│       │   ├── copilot-responses.ts
│       │   └── error-responses.ts
│       └── validation-outcomes/
│           ├── success-reports.ts
│           └── failure-reports.ts
│
├── mocks/                                   # Service mocks/stubs
│   ├── infrastructure/
│   │   ├── redis/
│   │   │   ├── redis-mock.ts               # In-memory Redis implementation
│   │   │   ├── redis-client-factory.ts     # Mock client factory
│   │   │   └── redis-fixtures.ts           # Predefined Redis states
│   │   │
│   │   ├── providers/
│   │   │   ├── base-provider.mock.ts       # Abstract provider mock
│   │   │   ├── gemini.mock.ts              # Gemini CLI mock
│   │   │   ├── copilot.mock.ts             # Copilot CLI mock
│   │   │   ├── cursor.mock.ts              # Cursor CLI mock
│   │   │   ├── claude.mock.ts              # Claude CLI mock
│   │   │   ├── codex.mock.ts               # Codex CLI mock
│   │   │   └── ollama.mock.ts              # Ollama mock
│   │   │
│   │   ├── filesystem/
│   │   │   ├── fs.mock.ts                  # Virtual filesystem
│   │   │   ├── sandbox-manager.mock.ts     # Sandbox operations
│   │   │   └── file-fixtures.ts            # Mock file contents
│   │   │
│   │   └── executor/
│   │       ├── command-executor.mock.ts    # child_process mock
│   │       ├── verification-commands.ts    # Predefined command outputs
│   │       └── process-spawner.mock.ts     # Process spawning mock
│   │
│   └── adapters/
│       ├── cli-adapter.mock.ts             # CLIAdapter mock
│       ├── circuit-breaker.mock.ts         # Circuit breaker mock
│       └── logger.mock.ts                  # Logger mock
│
└── helpers/
    ├── test-harness.ts                     # Test environment setup
    ├── state-builders.ts                   # Enhanced state construction
    ├── task-builders.ts                    # Task creation helpers
    ├── assertion-helpers.ts                # Custom Jest matchers
    ├── provider-simulator.ts               # Provider behavior simulation
    └── scenario-runner.ts                  # Scenario execution framework
```

## Plan Documents

This plan is broken down into detailed documents:

1. **[01-infrastructure-setup.md](./01-infrastructure-setup.md)**
   - Redis mock implementation
   - Test harness architecture
   - Helper utilities
   - Custom Jest matchers

2. **[02-service-mocks.md](./02-service-mocks.md)**
   - Provider CLI mocks (all 6 providers)
   - File system mock
   - Command executor mock
   - Circuit breaker mock

3. **[03-scenario-organization.md](./03-scenario-organization.md)**
   - Detailed scenario breakdowns by module
   - Test case specifications
   - Input/output definitions
   - Validation criteria

4. **[04-implementation-guide.md](./04-implementation-guide.md)**
   - Step-by-step implementation order
   - Module dependencies
   - Integration patterns
   - Common pitfalls

5. **[05-validation-metrics.md](./05-validation-metrics.md)**
   - Coverage targets
   - Performance benchmarks
   - Success criteria
   - CI/CD integration

## Key Principles

### 1. Determinism
- All tests produce identical results on every execution
- No random data, timestamps use fixed values
- Provider responses are predefined
- State transitions are predictable

### 2. Isolation
- Zero external service dependencies
- Each test can run independently
- No shared mutable state between tests
- Clean setup/teardown for each test

### 3. Speed
- Full suite executes in under 30 seconds
- In-memory operations only
- No disk I/O (virtual filesystem)
- No network calls (all mocked)

### 4. Clarity
- Test names describe exact scenario
- One assertion per logical concept
- Clear setup/action/assertion structure
- Comprehensive failure messages

### 5. Maintainability
- Modular mock implementations
- Reusable fixtures and builders
- Clear documentation
- Easy to extend with new scenarios

### 6. Realism
- Tests mirror actual operator workflows
- Task definitions match production patterns
- Provider responses reflect real behavior
- Edge cases from production incidents

## Testing Workflow

### Test Execution Flow
```
1. Setup Phase
   ├─ Initialize Redis mock
   ├─ Create virtual filesystem
   ├─ Configure provider mocks
   └─ Build initial state

2. Scenario Execution
   ├─ Load fixtures (tasks, state, responses)
   ├─ Run scenario steps
   ├─ Capture state changes
   └─ Collect execution traces

3. Validation Phase
   ├─ Assert state transitions
   ├─ Verify task status changes
   ├─ Check provider interactions
   └─ Validate side effects

4. Teardown Phase
   ├─ Clear Redis mock
   ├─ Reset filesystem
   ├─ Reset provider mocks
   └─ Clean up resources
```

### Assertion Strategy
- **State Assertions**: Verify supervisor status, iteration count, halt reasons
- **Task Assertions**: Check task status, retry counts, metadata preservation
- **Queue Assertions**: Validate queue operations, exhaustion detection
- **Provider Assertions**: Confirm correct provider selection, fallback behavior
- **Persistence Assertions**: Ensure state is correctly saved/loaded
- **Validation Assertions**: Check validation reports, confidence levels

## Success Criteria

### Functional Coverage
- [ ] All 7 scenario modules implemented
- [ ] Minimum 25 functional tests total
- [ ] Every critical workflow tested
- [ ] Edge cases covered (ambiguity, errors, failures)
- [ ] Recovery scenarios validated

### Technical Metrics
- [ ] Code coverage: >80% line coverage
- [ ] Branch coverage: >70%
- [ ] Test execution time: <30 seconds
- [ ] Zero external dependencies
- [ ] 100% pass rate (no flaky tests)

### Quality Standards
- [ ] All mocks thoroughly tested
- [ ] Fixtures comprehensive and realistic
- [ ] Clear documentation for each scenario
- [ ] Easy to add new test cases
- [ ] CI/CD ready

## Implementation Order

1. **Infrastructure Layer** (mocks, harness, helpers)
2. **Basic Scenarios** (happy path, simple state transitions)
3. **Complex Scenarios** (retry, fallback, recovery)
4. **Edge Cases** (ambiguity, errors, exhaustion)
5. **Validation & Refinement** (coverage, performance, cleanup)

## Reference Documentation

Related Foundry documentation:
- `/docs/ARCHITECTURE.md` - System architecture
- `/docs/STATE_LIFECYCLE.md` - State management
- `/docs/VALIDATION.md` - Validation rules
- `/docs/QUEUE_SYSTEM.md` - Queue operations
- `/docs/TOOL_CONTRACTS.md` - Provider contracts
- `/docs/AMBIGUITY_HANDLING.md` - Ambiguity detection
- `/docs/RECOVERY.md` - Crash recovery

## Next Steps

1. Review and approve this plan
2. Create infrastructure (Phase 1: Infrastructure Setup)
3. Implement service mocks (Phase 2: Service Mocks)
4. Build scenario tests (Phase 3: Scenarios by module)
5. Validate and refine (Phase 4: Coverage & metrics)

---

**Document Version**: 1.0  
**Last Updated**: January 11, 2026  
**Status**: Ready for Implementation
