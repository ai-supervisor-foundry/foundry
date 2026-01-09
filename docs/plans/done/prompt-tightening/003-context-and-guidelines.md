# 003 - Context Selectivity, Guidelines, Fix/Clarify Prompts

Purpose: minimize context tokens, simplify task-type guidance, remove redundant sections in fix/clarify prompts.

## buildMinimalState selectivity
- Include `goal` only if mentioned in instructions/intent/criteria or task_id starts with `goal-`.
- Include `queue` only if temporal terms present: previous, last task, earlier, after, before.
- Include `completed_tasks` only if extending/building on previous work: extend, build on, previous implementation, based on, intent contains extend (keep last 5 entries).
- Include `blocked_tasks` only if instructions mention unblock/blocked.
- For documentation tasks: include only `project`; omit queue/completed/blocked.
- Add debug log with included/omitted sections.

Example code adjustments:
```typescript
const criteriaText = task.acceptance_criteria.join(' ').toLowerCase();
const included: string[] = ['project'];
// ... push sections as added ...
logVerbose('BuildMinimalState', 'Context built', {
  task_id: task.task_id,
  included_sections: included.join(', '),
  omitted_sections: ['goal', 'queue', 'completed_tasks', 'blocked_tasks']
    .filter(s => !included.includes(s) && !included.some(i => i.startsWith(s)))
    .join(', ') || 'none',
});
```

## addTaskTypeGuidelines slimming
```typescript
function addTaskTypeGuidelines(sections: string[], taskType: TaskType): void {
  const sharedConstraints = [
    '- Ensure all exports are typed correctly',
    '- Do not introduce breaking changes to public APIs',
    '- No conversational filler; code + JSON only',
  ];

  sections.push('## Guidelines');

  switch (taskType) {
    case 'implementation': sections.push('- Focus on clean code structure and established patterns'); break;
    case 'configuration': sections.push('- Verify file locations and provide fallback values'); break;
    case 'testing': sections.push('- Cover edge cases with descriptive assertions'); break;
    case 'documentation': sections.push('- Use clear formatting and validate all links'); break;
    case 'refactoring': sections.push('- Preserve functionality while improving structure'); break;
    case 'behavioral': sections.push('- Provide clear conversational response addressing all parts'); break;
  }

  if (['implementation', 'refactoring', 'testing'].includes(taskType)) {
    sharedConstraints.forEach(c => sections.push(c));
  }

  sections.push('');
}
```

## buildFixPrompt tightening
- Remove repeated "Original task description" and "Acceptance criteria" sections.
- Instructions should include:
  - Fix ONLY issues in Validation Results; do not re-implement entire task.
  - Apply fixes directly with given data; do not ask questions or re-explain.
  - Ensure ALL acceptance criteria are met.
  - Remain in {AGENT_MODE} MODE; Working directory: {sandbox_root}.

## buildClarificationPrompt tightening
- Drop repeated task description/criteria sections.
- Clarification section:
  - If AMBIGUITY: "Previous response used ambiguous language (maybe, could, suggest, recommend, option). Provide definitive implementation using declarative statements."
  - If ASKED_QUESTION: "Previous response asked a question. Implement directly using only the information provided in the original task."
- Instructions: implement definitively, avoid ambiguous terms, stay in {AGENT_MODE}, set working directory.

## Token targets
- Implementation prompt: ~800 tokens (from ~1200)
- Documentation prompt: ~600 tokens (from ~900)
- Fix prompt: ~40% shorter than original + validation report