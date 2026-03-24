# 02b — Dependency Graph & Topological Sort

## Source Files
- `crates/arc-plan/src/plan_model.rs` — DependencyGraph, execution_order()
- `crates/arc-plan/src/dependency_mapper.rs` — File dependency builder
- `crates/arc-plan/src/tracker.rs` — TrackerTask, circular dep validation

## Dependency Graph Schema

```typescript
interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

interface DependencyNode {
  filePath: string;
  nodeType: 'module' | 'struct' | 'trait' | 'function' | 'test' | 'config';
  imports: string[];
  exports: string[];
  loc: number;
}

interface DependencyEdge {
  from: string;
  to: string;
  edgeType: 'import' | 'implements' | 'calls' | 'tests';
}
```

## Kahn's Topological Sort

```typescript
function executionOrder(steps: PlanStep[]): PlanStep[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const s of steps) {
    inDegree.set(s.id, s.dependencies.length);
    for (const dep of s.dependencies) {
      if (!adj.has(dep)) adj.set(dep, []);
      adj.get(dep)!.push(s.id);
    }
  }
  const queue = steps.filter(s => inDegree.get(s.id) === 0);
  const result: PlanStep[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const next of (adj.get(current.id) || [])) {
      inDegree.set(next, inDegree.get(next)! - 1);
      if (inDegree.get(next) === 0)
        queue.push(steps.find(s => s.id === next)!);
    }
  }
  return result;
}
```

## nextActionableSteps()

Returns all Pending steps whose dependencies are all Completed:

```typescript
function nextActionableSteps(steps: PlanStep[]): PlanStep[] {
  return steps.filter(s =>
    s.status === 'pending' &&
    s.dependencies.every(depId =>
      steps.find(d => d.id === depId)?.status === 'completed'
    )
  );
}
```

## Circular Dependency Detection (TrackerService)

On task close: DFS walk of dependency graph to detect cycles.
Validates all deps are Closed before allowing task close.

```typescript
function hasCircularDep(taskId: string, deps: Map<string, string[]>): boolean {
  const visited = new Set<string>();
  const stack = new Set<string>();
  function dfs(id: string): boolean {
    if (stack.has(id)) return true;   // cycle found
    if (visited.has(id)) return false;
    visited.add(id); stack.add(id);
    for (const dep of (deps.get(id) || []))
      if (dfs(dep)) return true;
    stack.delete(id);
    return false;
  }
  return dfs(taskId);
}
```

## Acceptance Criteria

- [ ] `executionOrder()` implements Kahn's algorithm
- [ ] `nextActionableSteps()` returns dependency-satisfied pending steps
- [ ] Circular dependency detection via DFS on plan creation
- [ ] DependencyGraph nodes track imports/exports for file analysis
