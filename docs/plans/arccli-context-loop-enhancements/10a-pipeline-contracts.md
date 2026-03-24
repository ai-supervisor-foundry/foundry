# 10a — Deterministic Agent Pipeline & Output Contracts

## Source Files
- `crates/arc-agents/src/orchestrator.rs` — 3-phase pipeline
- `crates/arc-agents/src/contracts.rs` — PlanOutput, ArchitectOutput, CoderOutput

## 3-Phase Pipeline

```
Plan → Architect → Code
```

Each phase enforces a strict JSON output schema. Validation gate between phases.

## Phase 1 — PlanOutput

```typescript
interface PlanOutput {
  taskSummary: string;
  steps: string[];
  estimatedFiles: string[];
  confidence: number;             // 0.0 - 1.0
  requiresClarification: boolean;
  clarificationQuestions: string[];
}
```

## Phase 2 — ArchitectOutput

```typescript
interface ArchitectOutput {
  fileSpecs: FileSpec[];
  newDependencies: Dependency[];
  architecturalNotes: string;
  confidence: number;
}

interface FileSpec {
  path: string;
  action: 'create' | 'modify' | 'delete' | 'rename';
  purpose: string;
  changesDescription: string;
  estimatedDiffSize: number;
}

interface Dependency {
  name: string;
  version: string;
  justification: string;
}
```

## Phase 3 — CoderOutput

```typescript
interface CoderOutput {
  fileEdits: FileEdit[];
  confidence: number;
  testSuggestions: string[];
}

interface FileEdit {
  path: string;
  editType: 'full_rewrite' | 'unified_diff' | 'search_replace';
  content: string;
}
```

## Confidence-Based Escalation

```typescript
function shouldEscalate(confidence: number): 'auto_proceed' | 'ask_user' | 'halt' {
  if (confidence >= 0.8) return 'auto_proceed';
  if (confidence >= 0.5) return 'ask_user';
  return 'halt';
}
```

Every agent output includes `confidence: number`. Orchestrator checks before
proceeding to next phase.

## JSON Extraction from LLM Response

```typescript
function extractJsonBlock(response: string): object | null {
  // 1. Try raw JSON.parse
  // 2. Try extracting from ```json ... ``` markdown fences
  // 3. Return null if neither works
}
```

## Acceptance Criteria

- [ ] Plan→Architect→Code pipeline with validation gates
- [ ] Typed JSON schemas enforced per phase (use Zod for validation)
- [ ] confidence field required on every agent output
- [ ] Escalation: ≥0.8 auto, ≥0.5 ask, <0.5 halt
- [ ] JSON extraction handles both raw and fenced responses
