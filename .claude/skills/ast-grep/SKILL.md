---
name: ast-grep
description: This skill enables Cursor to use **ast-grep** to analyze, query, and refactor code using structural patterns.  
---


# ast-grep Code Query & Refactor

This skill enables Cursor to use **ast-grep** to analyze, query, and refactor code using structural patterns.  
Cursor can call ast-grep to search for nodes, detect anti-patterns, or apply auto-fixes using SG rules.

---

## Capabilities

- Search code structurally using AST patterns (`pattern`, `regex`, `meta`).
- Run full ast-grep rulesets (`.yaml` rule files).
- Preview matches with context.
- Apply safe transformations using `fix` blocks.
- Generate new SG rules automatically when helpful.

Cursor may use this skill when:
- The user asks for *codebase-wide search/refactor*.
- Structural patterns or syntax-aware searches are required.
- A transformation should be validated using AST rather than regex.

---

## Commands

### **Search using a pattern**

Use when the user wants to find all occurrences of a code pattern.

```bash
ast-grep -p "<pattern>" <path>