# Documentation Update Plan: README.md Fixes

## Objective
Refine the first 100 lines of `README.md` to unify the value proposition, correct linguistic errors, remove redundancies, and improve professional tone.

## Identified Issues

### 1. Conflicting/Diluted Taglines
- **Current:**
  - "The Persistent Control Plane for Autonomous AI Software Factories."
  - "Autonomous AI software development platform."
  - "Kubernetes of Agentic Coding."
- **Problem:** The user is presented with three different definitions in the first screen.
- **Proposed Fix:** Unify around the "Control Plane" and "Kubernetes" analogy, as these are the strongest technical descriptors. Drop generic "platform" verbiage.

### 2. Linguistic & Grammatical Errors
- **Line 32:** "It tries to not sleep, persist state, retain context context, and avoid drifts."
  - *Issues:* "context context" (typo), "tries to not sleep" (weak/awkward).
  - *Fix:* "It runs continuously, persists state, retains context, and prevents drift."
- **Line 35:** "If it crashes? Resume where it left off."
  - *Issue:* Colloquial question format.
  - *Fix:* "Crash-resilient by design: resume execution exactly where it left off."
- **Line 55:** "off-the-shelf Human CLIs"
  - *Issue:* "Human CLIs" is confusing.
  - *Fix:* "Standard Developer CLIs" or "Provider CLIs".

### 3. Structural Redundancy
- **Issue:** The concepts of "Persistence", "Validation", and "Goals/Tasks" are introduced in "What This Is", then re-introduced in "Why Foundry Exists", and again in "How It Works".
- **Fix:** 
  - Keep "What This Is" high-level (The "What").
  - Keep "Why Foundry Exists" focused on the problem (The "Why").
  - Keep "How It Works" focused on the architecture (The "How").

## Proposed Content Changes

### Header Section
**Current:**
> The Persistent Control Plane for Autonomous AI Software Factories.

**Proposed:**
> **The Persistent Control Plane for Autonomous AI Development.**
> 
> *Orchestrate headless developer tools (Cursor, Copilot, Gemini) into deterministic, crash-proof software factories.*

### "What This Is" Section
**Current:**
> Think of it as the **"Kubernetes of Agentic Coding"**—it orchestrates "headless" AI worker nodes (Cursor, Copilot, Gemini) to execute complex, long-running engineering plans reliably.
> It tries to not sleep, persist state, retain context context, and avoid drifts.

**Proposed:**
> Foundry is the **"Kubernetes of Agentic Coding."**
>
> It orchestrates "headless" AI worker nodes (using standard CLIs like Cursor, Copilot, and Gemini) to execute complex, long-running engineering plans with strict reliability. Unlike chat-based agents that drift or lose context, Foundry enforces a rigid control loop: it persists state after every atomic step, validates outputs deterministically, and runs continuously without manual supervision.

### "Why Foundry is Different" Section
**Current:**
> The Anti-Planner (Strict Determinism)
> Foundry is a Task Runner, not a Problem Solver. It explicitly removes the "planning" capability from the agent...

**Proposed:**
> **The Execution Engine (Strict Determinism)**
> Foundry is a Task Runner, not a Planner. It decouples *intent* (the plan) from *execution* (the agent). By removing the "planning" responsibility from the worker agent, Foundry eliminates recursive scope creep and ensures the agent focuses solely on executing the explicit DAG (Directed Acyclic Graph) of tasks defined by the Operator.

## Action Items
1.  Apply linguistic fixes to lines 1-100.
2.  Consolidate the "Tagline" area.
3.  Standardize terms: Use "Operator" (user), "Supervisor" (Foundry), and "Worker" (AI Agent).
4.  Remove the "context context" typo.
