# 02a — Plan Schema & Data Model

## Source Files
- `crates/arc-plan/src/plan_model.rs` — Plan, PlanPhase, PlanStep

## Plan Schema

```typescript
interface Plan {
  id: string;
  createdAt: Date;
  title: string;
  description: string;
  phases: PlanPhase[];
  dependencyGraph: DependencyGraph;
  estimatedTokens: number;
  estimatedCostUsd: number;
  riskAssessment: RiskAssessment;
  filesToModify: FileModification[];
  filesToCreate: string[];
  filesToDelete: string[];
}

interface PlanPhase {
  id: string;
  name: string;
  steps: PlanStep[];
  canParallelize: boolean;
}
```

## PlanStep Schema

```typescript
interface PlanStep {
  id: string;
  phaseId: string;
  description: string;
  filePath?: string;
  action: StepAction;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  dependencies: string[];        // step UUIDs
  estimatedTokens: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  rationale: string;
}

type StepAction =
  | { type: 'read_analyze'; paths: string[] }
  | { type: 'modify'; path: string; description: string }
  | { type: 'create'; path: string; template?: string }
  | { type: 'delete'; path: string; reason: string }
  | { type: 'run_command'; command: string; safe: boolean }
  | { type: 'run_tests'; testPattern: string }
  | { type: 'refactor'; scope: string; pattern: string };
```

## Risk Assessment

```typescript
interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  breakingChanges: string[];
  testCoverageGaps: string[];
  securityConcerns: string[];
}
```

## Per-Step Tool Allowlists

| Action Type | Allowed Tools |
|-------------|---------------|
| read_analyze | read, grep, glob |
| modify | read, write, edit |
| run_command | bash (validated) |
| run_tests | bash (test commands only) |

## Acceptance Criteria

- [ ] Plan schema includes phases, steps, dependency UUIDs, risk levels
- [ ] StepAction is a discriminated union with typed variants
- [ ] Tool allowlists enforced per step action type
- [ ] RiskAssessment populated during plan generation
