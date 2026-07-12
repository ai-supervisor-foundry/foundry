import { TaskPromptStrategy as TaskStrategy } from '../TaskPromptStrategy';
import { MD_JSON_START, MD_CODE_END } from '../constants/markdownFences';

const commonRules: string[] = [
  '- Start by reviewing READ-ONLY CONTEXT, Description and Acceptance Criteria, this is the truth, no assumption',
  '- Keep responses contractual and exact - just final JSON block only - No extra explanations, pre or post text',
  '- Do not add any other fields apart from Contract. Use the exact keys provided. All file paths must be relative to project_root.',
  '- STOP and ask ONE clarifying question if the task is ambiguous',
]

const OUTPUT_CONTRACTS = {
  coding: {
    "status": { "type": "string", "enum": ["completed", "failed"], "description": "The status of the task", "required": true },
    "files_created": { "type": "array", "items": { "type": "string" }, "description": "The files created", "required": true, "example": ["relative/path/from/project_root"] },
    "files_updated": { "type": "array", "items": { "type": "string" }, "description": "The files updated", "required": true, "example": ["relative/path/from/project_root"] },
    "changes": { "type": "array", "items": { "type": "string" }, "description": "The changes", "required": true, "example": ["relative/path/from/project_root"] },
    "neededChanges": { "type": "boolean", "description": "Whether the task needed changes", "required": true, "example": true },
    "reasoning": { "type": "string", "description": "Briefly explain your technical approach or why it failed", "required": true },
    "summary": { "type": "string", "description": "One sentence describing what was done or why it failed", "required": true }
  },
  behavioural: {
    "status": { "type": "string", "enum": ["completed", "failed"], "description": "The status of the task", "required": true },
    "response": { "type": "string", "description": "The response to the user's question", "required": true },
    "confidence": { "type": "number", "description": "The confidence in the response", "required": true, "example": 0.0-1.0 },
    "reasoning": { "type": "string", "description": "Briefly explain why you gave this answer", "required": true }
  },
  verification: {
    "status": { "type": "string", "enum": ["completed", "failed"], "description": "The status of the task", "required": true },
    "findings": { "type": "array", "items": { "type": "string" }, "description": "The findings", "required": true, "example": ["Finding 1: ...", "Finding 2: ..."] },
    "verdict": { "type": "string", "enum": ["pass", "fail"], "description": "The verdict", "required": true, "example": "pass" },
    "reasoning": { "type": "string", "description": "Evidence-based conclusion", "required": true }
  },
  testing: {
    "status": { "type": "string", "enum": ["completed", "failed"], "description": "The status of the task", "required": true },
    "findings": { "type": "array", "items": { "type": "string" }, "description": "The findings", "required": true, "example": ["Finding 1: ...", "Finding 2: ..."] },
    "verdict": { "type": "string", "enum": ["pass", "fail"], "description": "The verdict", "required": true, "example": "pass" },
    "reasoning": { "type": "string", "description": "Evidence-based conclusion", "required": true }
  },
  configuration: {
    "status": { "type": "string", "enum": ["completed", "failed"], "description": "The status of the task", "required": true },
    "findings": { "type": "array", "items": { "type": "string" }, "description": "The findings", "required": true, "example": ["Finding 1: ...", "Finding 2: ..."] },
    "verdict": { "type": "string", "enum": ["pass", "fail"], "description": "The verdict", "required": true, "example": "pass" },
    "reasoning": { "type": "string", "description": "Evidence-based conclusion", "required": true }
  },
  documentation: {
    "status": { "type": "string", "enum": ["completed", "failed"], "description": "The status of the task", "required": true },
    "findings": { "type": "array", "items": { "type": "string" }, "description": "The findings", "required": true, "example": ["Finding 1: ...", "Finding 2: ..."] },
    "verdict": { "type": "string", "enum": ["pass", "fail"], "description": "The verdict", "required": true, "example": "pass" },
    "reasoning": { "type": "string", "description": "Evidence-based conclusion", "required": true }
  },
  refactoring: {
    "status": { "type": "string", "enum": ["completed", "failed"], "description": "The status of the task", "required": true },
    "findings": { "type": "array", "items": { "type": "string" }, "description": "The findings", "required": true, "example": ["Finding 1: ...", "Finding 2: ..."] },
    "verdict": { "type": "string", "enum": ["pass", "fail"], "description": "The verdict", "required": true, "example": "pass" },
    "reasoning": { "type": "string", "description": "Evidence-based conclusion", "required": true }
  }
}

export const CODING_STRATEGY: TaskStrategy = {
  getRules: (agentMode: string) => [
    '## Rules',
    ...commonRules,
    '- Follow established project patterns and cover all edge cases',
    '- Ensure all exports/imports are typed',
    '- All json fields are required, could be empty or empty arrays',
    '- If you are unsure or cannot complete, set "status": "failed" and explain briefly in summary.',
    '- After completed, update all unit-functional tests and context files (If and as required and If present).',
    '- If ecosystem.config.cjs (Higher prio) or ecosystem.config.js is present, run pm2 restart, run all tests again (If functional - definitely stubbed)',
    ''
  ],
  getOutputRequirements: () => [
    `## Output Requirements

JSON contract description: ${JSON.stringify(OUTPUT_CONTRACTS.coding, null, 2)}

Sample JSON output:
${MD_JSON_START}
WRITE JSON here following contract above. All fields are required, could be empty.
${MD_CODE_END}
`
  ]
};

export const BEHAVIORAL_STRATEGY: TaskStrategy = {
  getRules: (agentMode: string) => [
    '## Rules',
    ...commonRules,
    '- Answer the user\'s question directly, concisely but fully and clearly',
    '- Use information from the READ-ONLY CONTEXT to inform your answer',
    '- Do NOT assume, invent information, provide a clear "reasoning" for your answer',
    '- Clear declarative response addressing all points. Be natural in responses',
    ''
  ],
  getOutputRequirements: () => [
    `## Output Requirements

JSON contract description: ${JSON.stringify(OUTPUT_CONTRACTS.behavioural, null, 2)}

Sample JSON output:
${MD_JSON_START}
WRITE JSON here following contract above. All fields are required, could be empty.
${MD_CODE_END}
`
  ]
};

export const VERIFICATION_STRATEGY: TaskStrategy = {
  getRules: (agentMode: string) => [
    '## Rules',
    ...commonRules,
    '- Read actual files using `ast-grep` (for code structure and elements) or `cat` or `grep` to verify criteria',
    '- Do NOT modify any files (Read-Only)',
    '- Report specific findings with file paths - Mark findings as "pass" or "fail"',
    '- Provide evidence (file paths, line numbers) for every finding',
    '- If a criterion is ambiguous, explain why',
    ''
  ],
  getOutputRequirements: () => [
    `## Output Requirements
JSON contract description: ${JSON.stringify(OUTPUT_CONTRACTS.verification, null, 2)}

Sample JSON output:
${MD_JSON_START}
WRITE JSON here following contract above. All fields are required, could be empty.
${MD_CODE_END}
`
  ]
};

export const TESTING_STRATEGY: TaskStrategy = {
  ...CODING_STRATEGY,
  getRules: (agentMode: string) => [
    ...CODING_STRATEGY.getRules(agentMode),
    '- Descriptive assertions for edge cases',
    '- Verify specific failure conditions',
    '- Ensure test isolation',  
    ''
  ],
};

export const CONFIGURATION_STRATEGY: TaskStrategy = {
  ...CODING_STRATEGY,
  getRules: (agentMode: string) => [
    ...CODING_STRATEGY.getRules(agentMode),
    '- Verify file locations; use fallback values',
    '- Use environment variables for secrets',
    '- Validate configuration schema',
    ''
  ],
};

export const DOCUMENTATION_STRATEGY: TaskStrategy = {
  ...CODING_STRATEGY,
  getRules: (agentMode: string) => [
    ...CODING_STRATEGY.getRules(agentMode),
    '- Clear formatting; validate all links',
    '- Include code examples where appropriate',
    '- Keep documentation up-to-date with code',
    ''
  ]
};

export const REFACTORING_STRATEGY: TaskStrategy = {
  ...CODING_STRATEGY,
  getRules: (agentMode: string) => [
    ...CODING_STRATEGY.getRules(agentMode),
    '- Improve structure without changing behavior',
    '- Ensure existing tests pass',
    '- Keep changes atomic and focused',  
    ''
  ],
};