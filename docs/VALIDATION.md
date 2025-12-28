# Validation Checklist

- [ ] Was output generated for the specified task?
- [ ] Does output meet all acceptance criteria?
- [ ] Are test outputs present?
- [ ] Is state updated appropriately?
- [ ] Any ambiguity halts and requires operator clarification.

## Validation Rules

- Validation logic must be deterministic, rule-based, and non-AI.
- Examples: file exists, tests pass, diff matches criteria, artifact count matches expectation.
- If validation cannot be automated → HALT + operator clarification.

