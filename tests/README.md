# Supervisor Unit Tests

Comprehensive unit test suite for the Supervisor system.

## Test Coverage

### Domain Components

#### 1. **Task Queue** (`tests/unit/domain/taskQueue.test.ts`)
- Queue key formatting
- Task enqueueing (serialization, multiple tasks)
- Task dequeueing (FIFO order, empty queue handling)
- Data preservation through queue operations

#### 2. **Halt Detection** (`tests/unit/domain/haltDetection.test.ts`)
- Ambiguity detection in agent responses
- Question detection (asking for clarification)
- Hard halt conditions (execution failures, blocked status)
- JSON validation and schema checks
- Circuit breaker detection

#### 3. **Prompt Builder** (`tests/unit/domain/promptBuilder.test.ts`)
- Minimal state context building
- Selective context inclusion based on task relevance
- Goal context injection
- Queue context for dependencies
- Completed/blocked task tracking
- Context limiting (last 5 tasks)

#### 4. **Interrogator** (`tests/unit/domain/interrogator.test.ts`)
- Interrogation session creation
- Question generation for failed criteria
- Criterion satisfaction tracking
- Analysis result classification (COMPLETE/INCOMPLETE/UNCERTAIN)
- File path discovery during interrogation

#### 5. **Command Generator** (`tests/unit/domain/commandGenerator.test.ts`)
- Verification command generation
- File existence checks
- Test command execution
- JSON schema validation commands
- Artifact validation for multiple file types

#### 6. **Types** (`tests/unit/domain/types.test.ts`)
- SupervisorState structure and transitions
- Task structure and lifecycle
- ValidationReport structure
- All supervisor statuses (RUNNING, BLOCKED, HALTED, COMPLETED)
- Task types (coding, behavioral, configuration, testing, documentation, implementation, refactoring)
- Task status transitions

#### 7. **Output Parser** (`tests/unit/domain/outputParser.test.ts`) **NEW**
- JSON extraction from Cursor output (code blocks and plain JSON)
- Trailing text detection (security feature)
- Required keys validation
- Malformed JSON handling
- Type validation (objects only, no arrays/primitives at root)
- Security considerations (prevents code injection)

#### 8. **Recovery** (`tests/unit/domain/recovery.test.ts`) **NEW**
- CLI crash detection (non-zero exit code, no output)
- Partial task completion detection
- Conflicting state detection
- Recovery action recommendations
- Operator input requirement logic

#### 9. **Session Manager** (`tests/unit/domain/sessionManager.test.ts`) **NEW**
- Session ID override precedence
- Feature-based session lookup from state
- Session discovery for Gemini/Copilot providers
- Session recovery scenarios
- State updates with discovered sessions

### Application Components

#### 10. **Persistence** (`tests/unit/application/persistence.test.ts`)
- State serialization and storage
- State deserialization and loading
- Complex nested object handling
- Timestamp preservation
- Execution mode persistence
- State round-trip integrity

#### 11. **Validator** (`tests/unit/application/validator.test.ts`)
- Task output validation
- JSON output parsing and validation
- Acceptance criteria checking
- Behavioral vs. coding task validation
- Error handling and failure detection
- Test command validation
- Required artifacts validation
- Confidence level tracking

#### 12. **AST Service** (`tests/unit/application/ASTService.test.ts`) **NEW**
- Provider registration and initialization
- File extension to provider mapping
- Rule validation routing (FUNCTION_EXISTS, CLASS_EXISTS, EXPORT_EXISTS, etc.)
- Multi-language support
- Error handling and fallback behavior
- Validation without initialization

### Integration Tests

#### 13. **Supervisor Integration** (`tests/unit/integration.test.ts`)
- State transitions (RUNNING → COMPLETED/BLOCKED/HALTED)
- Task lifecycle management
- Queue management and task ordering
- Execution mode support (AUTO/MANUAL)
- Session management
- Goal completion detection

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Generate coverage report
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test -- taskQueue.test.ts
```

### Run tests matching pattern
```bash
npm test -- --testNamePattern="should detect ambiguity"
```

## Test Structure

```
tests/
├── unit/
│   ├── domain/
│   │   ├── taskQueue.test.ts
│   │   ├── haltDetection.test.ts
│   │   ├── promptBuilder.test.ts
│   │   ├── interrogator.test.ts
│   │   ├── commandGenerator.test.ts
│   │   └── types.test.ts
│   ├── application/
│   │   ├── persistence.test.ts
│   │   └── validator.test.ts
│   └── integration.test.ts
└── fixtures/
    └── mockData.ts
```

## Test Fixtures

### Mock Data (`tests/fixtures/mockData.ts`)
Provides factory functions for creating test objects:
- `createMockTask()` - Creates a task with sensible defaults
- `createMockState()` - Creates supervisor state with defaults
- `createMockValidationReport()` - Creates validation reports

## Key Testing Principles

1. **Unit Tests**: Test individual components in isolation
2. **Mock Dependencies**: Use Jest mocks for Redis, file system, etc.
3. **Deterministic**: Tests are repeatable and don't depend on external state
4. **Fast**: Tests run quickly with in-memory operations
5. **Clear**: Each test has a single, clear purpose

## Coverage Goals

- **Critical Paths**: 100% coverage of core logic (control loop, validation, halt detection)
- **Type Safety**: 100% coverage of type constraints
- **Error Handling**: Coverage of error conditions and edge cases
- **Integration**: Coverage of state transitions and component interactions

## Example Test Patterns

### Testing Pure Functions
```typescript
it('should detect ambiguity', () => {
  const result = containsAmbiguity('Maybe this works');
  expect(result).toBe(true);
});
```

### Testing Async Operations
```typescript
it('should enqueue a task', async () => {
  await enqueueTask(mockRedis, 'queue:tasks', task);
  expect(mockRedis.lpush).toHaveBeenCalled();
});
```

### Testing State Transitions
```typescript
it('should transition to COMPLETED', () => {
  state.supervisor.status = 'COMPLETED';
  expect(state.supervisor.status).toBe('COMPLETED');
});
```

## Notes

- Tests skip UI and script components as requested
- Focus on core domain logic and application services
- Use mocks for external dependencies (Redis, file system)
- Tests validate both success and failure paths
