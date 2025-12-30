# Supervisor Contexts

This directory contains comprehensive context documentation for the Supervisor system.

## Structure

```
supervisor-contexts/
├── CONTEXT.md          # Main comprehensive context (all supervisor info)
├── windows/            # Sliding window of 10 latest context files
│   ├── README.md      # Window directory instructions
│   └── (10 context files maintained manually)
└── README.md          # This file
```

## Main Context File

**`CONTEXT.md`** - Complete supervisor system documentation:
- Overview and core principles
- Architecture and role separation
- Control loop and state management
- Task schema and queue system
- Validation and interrogation
- Tool contracts and CLI adapter
- Sandbox enforcement
- Ambiguity handling and recovery
- Logging and auditability
- Installation, setup, and usage
- Configuration and PM2 integration

**Current Size**: ~2,734 words (~16K characters)

## Sliding Window (`windows/`)

The `windows/` directory contains the **10 latest context files** for recent changes and updates.

### Size Recommendations

For **very large context models** (200K-1M+ tokens):

- **Target Size per File**: 50K-100K tokens
  - Approximately **30K-60K words**
  - Approximately **200K-400K characters**
  - Approximately **150-300 pages** (assuming ~200 words/page)

- **Total Window Capacity**: 500K-1M tokens (10 files × 50K-100K tokens)

### Content Guidelines

Each window file should be:
- **Focused**: Cover a specific topic or recent change
- **Comprehensive**: Self-contained with all necessary context
- **Structured**: Clear sections and headings for easy navigation
- **Up-to-date**: Reflect the latest system state and changes

### Example Topics for Window Files

- Recent architectural changes
- New feature implementations
- Updated operational procedures
- Critical bug fixes and workarounds
- System state and configuration changes
- Performance optimizations
- Validation improvements
- CLI adapter enhancements

## Usage

### For Agents Working on Supervisor

1. **Start with main context**: Read `supervisor-contexts/CONTEXT.md` first
2. **Check recent changes**: Review files in `supervisor-contexts/windows/` for updates
3. **Reference as needed**: Use context files to understand system behavior and constraints

### For Agents Working on Projects

- Use `contexts/<project-name>/` for project-specific context
- Supervisor context is not needed for project tasks

## Maintenance

- **Main Context**: Update `CONTEXT.md` when core system documentation changes
- **Window Files**: Manually maintained by operator (do not auto-generate)
- **Rotation**: When adding a new window file, remove the oldest to maintain exactly 10 files

## File Naming Convention

Window files should use descriptive names with timestamps or sequence numbers:
- `context-2024-12-29-001.md`
- `context-2024-12-29-002.md`
- Or: `context-001.md`, `context-002.md`, etc.

