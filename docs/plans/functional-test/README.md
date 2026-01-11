# Functional Testing Plan - Overview

This directory contains the comprehensive functional testing plan for Foundry, organized into detailed documents covering infrastructure, mocks, scenarios, implementation, and validation.

---

## Document Organization

### [main.plan.md](./main.plan.md) (312 lines)
**Main Planning Document** - Overview of functional testing strategy.  
Read this first to understand the overall approach.

### [01-infrastructure-setup/](./01-infrastructure-setup/) 
**Infrastructure Layer** - Foundation for all functional tests  
- `redis-harness.md` (400 lines) - Redis mock + Test harness
- `builders-matchers.md` (302 lines) - State/task builders + Jest matchers
- `index.md` - (701 lines) Complete reference - use to cross-reference all details

### [02-service-mocks/](./02-service-mocks/)
**Service Mocking Layer** - Mock all external dependencies  
- `providers.md` (350 lines) - Provider CLI mocks (all 6 providers)
- `infrastructure.md` (558 lines) - File system, executor, adapter mocks
- `index.md` - (907 lines) Complete reference - use to cross-reference all details

### [03-scenario-organization/](./03-scenario-organization/)
**Test Scenarios** - 25+ functional tests across 7 modules  
- `control-validation.md` (450 lines) - Control loop + task lifecycle + provider management
- `queue-modes.md` (490 lines) - Persistence + validation + queue + execution modes
- `index.md` - (939 lines) Complete reference - use to cross-reference all scenarios

### [04-implementation-guide/](./04-implementation-guide/)
**Step-by-Step Implementation** - Practical guidance  
- `phases-infrastructure.md` (400 lines) - 5 implementation phases
- `patterns-debugging.md` (303 lines) - Patterns, pitfalls, debugging, optimization
- `index.md` - (702 lines) Complete reference - use to cross-reference all guidance

### [05-validation-metrics/](./05-validation-metrics/)
**Success Metrics** - How to measure and validate  
- `coverage-performance.md` (400 lines) - Coverage targets + performance benchmarks
- `ci-cd-maintenance.md` (288 lines) - CI/CD integration + maintenance guidelines
- `index.md` - (687 lines) Complete reference - use to cross-reference all metrics

---

## Quick Reference

### Key Statistics

| Metric | Target |
|--------|--------|
| **Test Modules** | 7 |
| **Minimum Test Cases** | 25 |
| **Line Coverage** | ≥80% |
| **Branch Coverage** | ≥70% |
| **Execution Time** | <30 seconds |
| **Flaky Tests** | 0 |
| **External Dependencies** | 0 (all mocked) |

### Implementation Phases

```
Phase 1: Infrastructure Setup
  └─ Redis mock, test harness, builders, matchers

Phase 2: Service Mocks
  └─ Provider mocks, filesystem, executor, adapters

Phase 3: Test Harness
  └─ TestHarness class, scenario runner, trace capture

Phase 4: Custom Matchers
  └─ Foundry-specific Jest matchers

Phase 5: Scenario Implementation
  └─ 25+ functional tests across 7 modules
```

### Test Structure

```
tests/
├── functional/
│   ├── scenarios/
│   │   ├── control-loop/        # State machine tests
│   │   ├── task-lifecycle/       # Task processing tests
│   │   ├── provider-management/  # Provider fallback tests
│   │   ├── persistence/          # Recovery tests
│   │   ├── validation/           # Validation tests
│   │   ├── queue-operations/     # Queue tests
│   │   └── execution-modes/      # Mode switching tests
│   └── fixtures/
│       ├── tasks/
│       ├── states/
│       ├── provider-responses/
│       └── validation-outcomes/
├── mocks/
│   ├── infrastructure/
│   │   ├── redis/
│   │   ├── providers/
│   │   ├── filesystem/
│   │   └── executor/
│   └── adapters/
└── helpers/
    ├── test-harness.ts
    ├── state-builders.ts
    ├── task-builders.ts
    ├── assertion-helpers.ts
    └── scenario-runner.ts
```

---

## Key Principles

### 1. **Determinism**
All tests produce identical results on every run. No random data, fixed timestamps, predictable state transitions.

### 2. **Isolation**
Zero external dependencies. Each test runs independently with clean setup/teardown.

### 3. **Speed**
Full suite executes in under 30 seconds. In-memory operations only, no disk I/O or network calls.

### 4. **Clarity**
Test names describe exact scenarios. Clear setup/action/assertion structure with comprehensive failure messages.

### 5. **Maintainability**
Modular mocks, reusable fixtures and builders, clear documentation, easy to extend.

### 6. **Realism**
Tests mirror actual operator workflows with production-like task definitions and realistic edge cases.

---

## Reading Order

### For Implementers
1. [main.plan.md](./main.plan.md) - Understand the overall approach
2. [01-infrastructure-setup.md](./01-infrastructure-setup.md) - Start with foundation
3. [02-service-mocks.md](./02-service-mocks.md) - Build service mocks
4. [04-implementation-guide.md](./04-implementation-guide.md) - Follow step-by-step guide
5. [03-scenario-organization.md](./03-scenario-organization.md) - Implement scenarios
6. [05-validation-metrics.md](./05-validation-metrics.md) - Validate and measure

### For Reviewers
1. [main.plan.md](./main.plan.md) - Understand scope and objectives
2. [03-scenario-organization.md](./03-scenario-organization.md) - Review test coverage
3. [05-validation-metrics.md](./05-validation-metrics.md) - Review success criteria
4. Other documents as needed for deep dives

### For Maintainers
1. [04-implementation-guide.md](./04-implementation-guide.md) - Adding new tests
2. [05-validation-metrics.md](./05-validation-metrics.md) - Maintaining quality
3. [03-scenario-organization.md](./03-scenario-organization.md) - Finding existing tests

---

## Implementation Status

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Infrastructure | Not Started | 0% |
| Phase 2: Service Mocks | Not Started | 0% |
| Phase 3: Test Harness | Not Started | 0% |
| Phase 4: Custom Matchers | Not Started | 0% |
| Phase 5: Scenarios | Not Started | 0% |

**Overall Progress**: 0%

---

## Next Steps

1. **Review and approve** this plan
2. **Start Phase 1**: Implement infrastructure (Redis mock, test harness, builders)
3. **Validate Phase 1**: Ensure foundation is solid before proceeding
4. **Continue sequentially** through remaining phases
5. **Track progress** using the checklist in [05-validation-metrics.md](./05-validation-metrics.md)

---

## Contact / Questions

For questions about this plan or clarifications during implementation, refer to:
- Related Foundry documentation in `/docs/`
- Architecture documentation in `/docs/ARCHITECTURE.md`
- State management in `/docs/STATE_LIFECYCLE.md`

---

**Plan Version**: 1.0  
**Created**: January 11, 2026  
**Status**: Ready for Implementation  
**Total Pages**: ~1,850 lines across 6 documents
