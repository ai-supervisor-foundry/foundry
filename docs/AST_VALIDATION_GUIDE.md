# AST-Based Validation Guide

## Overview

AST (Abstract Syntax Tree) validation is an advanced code verification strategy that goes beyond simple keyword or regex matching. By parsing source code into a tree structure, the supervisor can definitively verify the existence of classes, functions, exports, and other structural elements.

## Why AST Validation?

- **Eliminates False Positives**: Unlike regex, AST ignores comments and strings. It won't pass a task just because you have a `// TODO: implement login` comment.
- **Handles Formatting Variety**: Whether a function is defined as `function login() {}` or `const login = () => {}`, the AST parser understands it's the same structural element.
- **High Confidence**: Results from AST validation are binary (Pass/Fail) and highly reliable, reducing the need for the **Interrogation Phase**.

## Architecture (Adapter Pattern)

The supervisor uses an **Interface-Adapter Architecture** to support multiple languages:

- **ASTProvider (Interface)**: Defines standard checks like `hasFunction`, `hasClass`, `hasExport`.
- **TsMorphAdapter (Implementation)**: Current default for TypeScript and JavaScript.
- **ASTService (Factory)**: Automatically selects the correct adapter based on the file extension (`.ts`, `.py`, etc.).

## How to Use AST Validation

AST validation is automatically triggered for `coding` tasks if an adapter exists for the files in `required_artifacts`.

### Example Task with AST Criteria

```json
{
  "task_id": "create-user-service",
  "task_type": "coding",
  "required_artifacts": ["src/services/userService.ts"],
  "acceptance_criteria": [
    "Export a class named 'UserService'",
    "Class must have a method named 'findById'",
    "Method 'findById' must be async"
  ]
}
```

## Supported Languages

| Language | Adapter | File Extensions |
|----------|---------|-----------------|
| TypeScript | `ts-morph` | `.ts`, `.tsx` |
| JavaScript | `ts-morph` | `.js`, `.jsx` |
| Python | (Coming Soon) | `.py` |
| Go | (Coming Soon) | `.go` |

## Fallback Logic

If an AST check is inconclusive or a language isn't supported, the system automatically falls back to **Regex/Keyword Matching** and sets the validation confidence to `LOW`.

## Troubleshooting

### Issue: "Class not found" even though it exists
- **Cause**: The file might not be included in the `required_artifacts` or the `tsconfig.json` is missing/misconfigured.
- **Solution**: Ensure the file path is correct and within the sandbox project root.

### Issue: "Method not found" on arrow function
- **Cause**: Some adapters might distinguish between `method()` and `property = () => `.
- **Solution**: The `TsMorphAdapter` is designed to handle both, but check the specific adapter documentation if using a custom implementation.
