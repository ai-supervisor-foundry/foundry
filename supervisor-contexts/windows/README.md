# Supervisor Context Windows

This directory contains a sliding window of the 10 latest context markdown files for the supervisor system.

## Purpose

These files provide comprehensive context for AI agents working on the supervisor system, allowing them to understand the full system architecture, implementation details, and operational procedures without needing to read all documentation files.

## File Size Guidelines

Each context file should be optimized for **very large context models** (200K-1M+ tokens):

- **Target Size**: 50K-100K tokens per file (approximately 30K-60K words or 200K-400K characters)
- **Format**: Markdown with clear sections and headings
- **Content**: Focused, comprehensive, and self-contained

## Sliding Window

- Maintain exactly **10 files** in this directory
- Files are named with timestamps or sequence numbers (e.g., `context-001.md`, `context-002.md`, etc.)
- When a new file is added, the oldest file is removed
- Files are manually updated by the operator

## Current Files

The operator maintains this directory manually. Files should cover:
- Recent architectural changes
- New features and implementations
- Updated operational procedures
- Critical bug fixes and workarounds
- System state and configuration changes

## Usage

Agents should read the main `CONTEXT.md` first, then reference these window files for recent changes and updates.

