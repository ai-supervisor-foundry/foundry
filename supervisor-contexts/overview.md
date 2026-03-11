# Overview

The Supervisor is a **persistent orchestration layer for AI-assisted software development** that enables long-running, restart-safe project execution with full operator control and auditability. It is a control plane that externalizes memory, intent, and control so work can continue across interruptions, sleep, crashes, or session loss.

## Software Factory Concept

The Supervisor operates like a **software factory** or **Replit-like environment** where you provide:

1. **Code Boilerplates**: Initial project structure, existing codebase, or starter templates
2. **Tasks**: Explicit task definitions with acceptance criteria (what needs to be built)
3. **Goal**: High-level project objective (what the project should achieve)

The Supervisor then **autonomously works on the project** by:
- Executing tasks sequentially in the sandbox environment
- Building upon existing code and boilerplates
- Validating each task's completion
- Maintaining persistent state across sessions
- Continuing work until the goal is achieved or tasks are exhausted

**Workflow**:
```
Operator provides:
  ├─ Code Boilerplates (in sandbox/<project-id>/)
  ├─ Tasks (via enqueue command)
  └─ Goal (via set-goal command)
         ↓
Supervisor autonomously:
  ├─ Executes tasks in order
  ├─ Works with existing code
  ├─ Validates outputs
  ├─ Persists state
  └─ Continues until goal met or halted
```

## Core Purpose

The Supervisor provides:
- **Persistence**: State survives crashes, restarts, and interruptions
- **Deterministic Control**: No surprises—explicit validation, clear halt conditions
- **Long-Running Projects**: Work on complex projects over days or weeks
- **Full Auditability**: Every action is logged and reviewable
- **Cost-Effective**: Uses free tier tools (provider CLIs, DragonflyDB)
- **Autonomous Execution**: Works on projects without constant operator intervention

## The Problem It Solves

AI coding agents are powerful but ephemeral—context is lost on interruption, making long-running projects difficult. The Supervisor bridges this gap by maintaining persistent state and deterministic execution. It enables a **"set it and forget it"** workflow where you provide boilerplates, tasks, and a goal, then the supervisor autonomously builds the project.
