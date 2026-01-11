# Validation and Metrics Plan

## Overview

This document defines success criteria, coverage targets, performance benchmarks, and CI/CD integration for the functional test suite.

---

## 1. Coverage Targets

### 1.1 Code Coverage Goals

**Overall Targets**:
- **Line Coverage**: ≥80%
- **Branch Coverage**: ≥70%
- **Function Coverage**: ≥75%
- **Statement Coverage**: ≥80%

**Module-Specific Targets**:

| Module | Line Coverage | Branch Coverage | Priority |
|--------|--------------|-----------------|----------|
| `src/domain/` | ≥85% | ≥75% | Critical |
| `src/application/` | ≥80% | ≥70% | High |
| `src/infrastructure/adapters/` | ≥75% | ≥65% | High |
| `src/infrastructure/connectors/` | ≥70% | ≥60% | Medium |
| `src/config/` | ≥60% | ≥50% | Low |

**Excluded from Coverage**:
- Type definition files (*.d.ts)
- Generated code
- `src/infrastructure/tooling/` (tool integrations)
- `src/infrastructure/network/` (external network code)

### 1.2 Scenario Coverage

**Required Scenarios**: Minimum 25 functional tests covering:

| Category | Minimum Tests | Status |
|----------|--------------|--------|
| Control Loop | 3 | Pending |
| Task Lifecycle | 4 | Pending |
| Provider Management | 4 | Pending |
| Persistence | 4 | Pending |
| Validation | 4 | Pending |
| Queue Operations | 3 | Pending |
| Execution Modes | 3 | Pending |

**Coverage Matrix**:

```
Feature: State Transitions
├─ IDLE → RUNNING ✓
├─ RUNNING → HALTED ✓
├─ RUNNING → BLOCKED ✓
├─ RUNNING → COMPLETED ✓
├─ BLOCKED → RUNNING ✓
└─ HALTED → RUNNING ✓

Feature: Provider Fallback
├─ Primary fails, secondary succeeds ✓
├─ Cascade through 3 providers ✓
├─ All providers fail ✓
└─ Circuit breaker triggers fallback ✓

Feature: Validation
├─ All criteria pass ✓
├─ One criterion fails ✓
├─ Ambiguity detected ✓
├─ AST validation ✓
└─ Behavioral validation ✓
```

### 1.3 Edge Case Coverage

**Critical Edge Cases**:
- [ ] Empty queue
- [ ] Null task ID
- [ ] Corrupted state JSON
- [ ] Missing required fields
- [ ] Max retry exceeded
- [ ] All providers down
- [ ] Concurrent state access
- [ ] Incomplete provider response
- [ ] Invalid acceptance criteria
- [ ] Circular task dependencies

---

## 2. Performance Benchmarks

### 2.1 Execution Speed

**Target**: Full test suite completes in <30 seconds

**Per-Module Targets**:
| Module | Max Duration | Notes |
|--------|-------------|-------|
| Infrastructure tests | 5s | Mock unit tests |
| Control loop scenarios | 8s | State machine tests |
| Task lifecycle scenarios | 7s | Task processing |
| Provider management | 6s | Fallback/circuit breaker |
| Persistence scenarios | 4s | State save/load |
| Validation scenarios | 5s | Criteria matching |
| Queue operations | 3s | Queue manipulation |
| Execution modes | 2s | Mode switching |

### 2.2 Performance Metrics

**Track Key Metrics**:
```typescript
interface PerformanceMetrics {
  totalDuration: number;        // Total test suite time
  averageTestDuration: number;  // Mean per test
  slowestTests: TestTiming[];   // Top 10 slowest
  setupTeardownTime: number;    // Overhead
  mockCreationTime: number;     // Mock initialization
}
```

**Performance Monitoring**:
```typescript
// Capture in tests/helpers/performance-monitor.ts
export class PerformanceMonitor {
  startTimer(label: string): void;
  stopTimer(label: string): number;
  getMetrics(): PerformanceMetrics;
  reportSlowTests(threshold: number): TestTiming[];
}
```

**Performance Thresholds**:
- Single test: <1000ms (warn if exceeded)
- Test suite: <30000ms (fail if exceeded)
- Mock setup: <100ms per mock
- State load/save: <50ms

### 2.3 Memory Usage

**Targets**:
- Maximum heap usage: <512MB
- No memory leaks between tests
- Mock cleanup verified

**Monitoring**:
```typescript
// In afterEach
afterEach(() => {
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed > 512 * 1024 * 1024) {
    console.warn('High memory usage:', memUsage);
  }
});
```

---

## 3. Quality Metrics

### 3.1 Test Reliability

**Zero Flaky Tests**:
- Tests must pass 100% of the time
- No race conditions
- No timing dependencies
- Deterministic assertions

**Validation**:
```bash
# Run 10 times to check for flakiness
for i in {1..10}; do npm test; done
```

**Flakiness Detection**:
- If any test fails once in 10 runs → investigate
- If any test shows different results → fix immediately

### 3.2 Test Clarity

**Readable Test Names**:
```typescript
// Good
it('should transition from RUNNING to BLOCKED when ambiguity detected')

// Bad
it('test state change')
```

**Clear Failure Messages**:
```typescript
// Custom matchers provide context
expect(state).toHaveSupervisorStatus('COMPLETED');
// Failure: Expected status COMPLETED but got RUNNING at iteration 5
```

**Test Documentation**:
- Each scenario file has JSDoc header
- Complex setups have inline comments
- Assertion rationale documented

### 3.3 Maintainability Score

**Criteria**:
- [ ] No duplicated test setup code
- [ ] Builders used consistently
- [ ] Mocks configured through harness
- [ ] Magic numbers avoided (use constants)
- [ ] Test helpers well-organized
- [ ] Clear file structure

**Code Smell Detection**:
- Tests over 100 lines → consider splitting
- Repeated setup → extract to beforeEach
- Hardcoded values → use fixtures/constants
- Complex assertions → create custom matcher

---

## 4. CI/CD Integration

### 4.1 GitHub Actions Workflow

**File**: `.github/workflows/functional-tests.yml`

```yaml
name: Functional Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    name: Functional Test Suite
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run functional tests
        run: npm run test:functional
        env:
          NODE_ENV: test
      
      - name: Check coverage thresholds
        run: npm run test:coverage
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: functional
          name: functional-tests
      
      - name: Archive test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            coverage/
            test-results/
      
      - name: Performance check
        run: |
          if [ -f performance-report.json ]; then
            node scripts/check-performance.js
          fi
```

### 4.2 Pre-commit Hooks

**File**: `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run affected tests
npm run test:affected

# Ensure coverage thresholds met
npm run test:coverage -- --changedSince=main
```

### 4.3 Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:functional": "jest tests/functional",
    "test:affected": "jest --changedSince=HEAD",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2 --json --outputFile=test-results.json",
    "test:performance": "node scripts/measure-test-performance.js"
  }
}
```

### 4.4 Coverage Reporting

**Codecov Configuration** (`.codecov.yml`):

```yaml
coverage:
  status:
    project:
      default:
        target: 80%
        threshold: 2%
    patch:
      default:
        target: 75%
  
  ignore:
    - "src/**/*.d.ts"
    - "src/infrastructure/tooling/**"
    - "src/infrastructure/network/**"
    - "tests/**"

comment:
  layout: "reach, diff, flags, files"
  behavior: default
```

---

## 5. Success Criteria

### 5.1 Functional Requirements

**All scenarios must pass**:
- [ ] Control loop happy path
- [ ] All state transitions
- [ ] Task dispatch and completion
- [ ] Validation and retry logic
- [ ] Provider fallback
- [ ] Circuit breaker functionality
- [ ] Crash recovery
- [ ] State persistence
- [ ] Ambiguity detection
- [ ] Queue operations
- [ ] Execution mode switching

### 5.2 Technical Requirements

**Infrastructure**:
- [ ] Redis mock fully functional
- [ ] All 6 provider mocks implemented
- [ ] File system mock operational
- [ ] Command executor mock working
- [ ] Test harness integrates all mocks
- [ ] Custom matchers registered

**Mocking**:
- [ ] Zero external dependencies
- [ ] All network calls mocked
- [ ] All file I/O mocked
- [ ] All process execution mocked
- [ ] Mock reset works correctly

**Performance**:
- [ ] Full suite runs in <30 seconds
- [ ] No single test exceeds 1 second
- [ ] Memory usage under 512MB
- [ ] No memory leaks detected

### 5.3 Quality Requirements

**Test Quality**:
- [ ] All tests deterministic (100% pass rate)
- [ ] No flaky tests (10 consecutive runs pass)
- [ ] Clear test names
- [ ] Comprehensive failure messages
- [ ] Edge cases covered

**Code Quality**:
- [ ] Code coverage ≥80% lines
- [ ] Branch coverage ≥70%
- [ ] No duplicated test code
- [ ] Well-documented scenarios
