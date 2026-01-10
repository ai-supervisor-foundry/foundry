# Foundry Rebranding & Documentation Update

**Status:** Completed
**Date:** 2026-01-09

## 1. Overview
We are renaming the project from **Supervisor** to **Foundry** to better reflect its role as a persistent, industrial-grade "Software Factory" control plane. The previous name implied a passive observer, whereas the system actively drives execution, enforces persistence, and manages state.

Additionally, we are correcting the project description to explicitly clarify that **the operator** (not the system) is responsible for defining goals and breaking them into tasks.

## 2. New Identity

### Name: **Foundry**

### Tagline
**The Persistent Control Plane for Autonomous AI Software Factories.**

### Description
**Foundry** is a deterministic orchestration engine that transforms ephemeral AI coding agents into reliable, long-running software developers. Unlike transient chat assistants, Foundry externalizes project state, memory, and intent into a persistent layer (DragonflyDB), enabling it to execute complex, multi-day engineering goals without context loss.

Acting as a strict control plane, it manages a **Software Factory** workflow where **you define the goal and break it into explicit tasks**, which Foundry then autonomously dispatches to provider CLIs (Cursor, Gemini, Copilot) and rigorously validates before progression. With features like sandbox isolation, deterministic output validation, and auto-recovery from ambiguity, Foundry ensures that AI development is audit-safe, restartable, and strictly aligned with operator intent.

## 3. Changes Required

### 3.1 Documentation Updates
- [ ] **README.md**:
    - Update Title and Description.
    - Update "What This Is" and "How It Works" sections to reflect the new branding.
    - Clarify the "Operator provides: Tasks" workflow.
- [ ] **docs/ARCHITECTURE.md**:
    - Update terminology (Supervisor Core -> Foundry Core).
    - Refine the "Software Factory" concept.
- [ ] **docs/*.md**:
    - Grep for "Supervisor" and replace with "Foundry" where referring to the system name.

### 3.2 Codebase Updates (Metadata)
- [ ] **package.json**: Update `name` and `description`.
- [ ] **GEMINI.md** / **.cursor/rules**: Update system prompts and context files to refer to the system as Foundry.

### 3.3 Terminology Standardization
- **Operator**: The human user who defines goals and tasks.
- **Foundry**: The persistent control plane (formerly Supervisor).
- **Worker/Agent**: The external CLI tool (Cursor, Gemini) executing the work.
- **Factory**: The overall environment (Sandbox + Foundry + Agents).

## 4. Execution Plan
1.  Create this plan.
2.  Update `package.json` metadata.
3.  Rewrite `README.md` with the new description.
4.  Update `docs/ARCHITECTURE.md` and other key docs.
