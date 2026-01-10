# AWS Labs Agent-Squad Framework — Alignment & Deviation Analysis

Reference: AWS Labs [Agent-Squad](https://awslabs.github.io/agent-squad/) (open-source multi-agent orchestration framework). This doc analyzes what we can adopt, what deviates from our deterministic model, and concrete integration hooks.

## Agent-Squad Architecture (Summary)

### Key Flow
1. **Request Initiation**: User sends request to orchestrator.
2. **Classification**: LLM classifier analyzes request + agent descriptions + conversation history → selects best agent.
3. **Routing**: Request sent to chosen agent.
4. **Agent Processing**: Selected agent retrieves its conversation history (per user/session) and processes.
5. **Response Generation**: Agent generates response (standard or streaming).
6. **Storage**: Orchestrator saves conversation (user input + agent response).
7. **Delivery**: Response returned to user.

### Main Components
- **Orchestrator**: Central coordinator; manages flow between Classifier, Agents, Storage, Retrievers; handles errors/fallbacks.
- **Classifier**: LLM-based intent classifier; examines input + agent descriptions + history; selects agent. (Customizable; can replace.)
- **Agents**: Prebuilt (LLMs, Bedrock, Lambda, Lex, custom) or custom. Unified abstraction; standard `processRequest()` interface.
- **Conversation Storage**: Dual-level (classifier context + agent context); in-memory, DynamoDB, or custom; per user/session.
- **Retrievers**: Enhance LLM performance; provide context on-demand; prebuilt or custom.

### Design Principles
- **Intelligent Intent Routing**: Classifier dynamically routes based on context.
- **Context Separation**: Global classifier history; per-agent isolated histories.
- **Unified Agent Abstraction**: Same code for Bedrock, Lambda, local models, Lex, APIs.
- **Flexible Storage**: Multiple backend options; easy to swap.
- **Extensibility**: Custom classifiers, agents, retrievers, storage.

---

## Alignment With Our Supervisor/MAO

### Strong Fits

1. **Orchestrator = Supervisor**
   - Both own the control loop and orchestration.
   - Both coordinate agents and manage flow.
   - **Alignment**: Supervisor as orchestrator; our deterministic control loop matches Agent-Squad's central coordination.
   - **Enhancement**: Agent-Squad's error handling and fallback mechanisms (already implicit in our CB) are well-documented; can formalize.

2. **Classifier Pattern (With Caveats)**
   - Agent-Squad uses LLM classifier for dynamic routing.
   - **Deviation Risk**: LLM-based classification is nondeterministic and opaque.
   - **Our Adaptation**: Replace with rule-based classifier (intent keywords, error patterns, provider CB state) to retain determinism.
   - **Benefit**: Keeps the abstraction; gains predictability.

3. **Conversation Storage (Dual-Level)**
   - Agent-Squad separates classifier history (global) from agent histories (per-agent).
   - **Alignment**: Matches our state access principle: global state in DragonflyDB; agents receive read-only snapshots.
   - **Enhancement**: Formalizing two-level storage mirrors our approach; validates architecture.

4. **Per-User/Session Context**
   - Agent-Squad maintains conversation history per user/session; agents see only their own.
   - **Alignment**: Matches our sandbox and state scoping; agents don't cross-pollinate.
   - **Enhancement**: Explicit user/session tracking can improve multi-tenant auditability.

5. **Unified Agent Abstraction**
   - Agent-Squad's `processRequest()` interface is provider-agnostic (Bedrock, Lambda, local, API).
   - **Alignment**: Matches our provider CLI adapter pattern; single interface for many backends.
   - **Enhancement**: Formalizing a unified agent interface simplifies role-based dispatch.

6. **Retrievers for Context Injection**
   - Agent-Squad retrievers pull context on-demand; avoid bloating prompts.
   - **Alignment**: Matches our smart context injection (promptBuilder); retrievers = minimal state snapshots.
   - **Enhancement**: Formalizing "retriever" pattern clarifies context management; can add role-scoped retrievers.

7. **Error Handling & Fallback**
   - Agent-Squad orchestrator handles errors and fallback.
   - **Alignment**: Our circuit breaker + provider fallback.
   - **Enhancement**: Agent-Squad's abstraction is cleaner; can adopt error categorization and fallback precedence model.

### Deviations (Risk Areas)

1. **LLM-Based Classification**
   - **Agent-Squad**: Classifier is an LLM.
   - **Our Model**: Deterministic, operator-controlled; no autonomous LLM routing.
   - **Impact**: Agent-Squad's routing is nondeterministic; ours must be rule-based.
   - **Solution**: Use Agent-Squad architecture but replace classifier with deterministic intent router (regex/rules).

2. **Dynamic Agent Discovery**
   - **Agent-Squad**: Agents registered at runtime; classifier sees all descriptions; can route to any.
   - **Our Model**: Operator defines roles upfront; routing is predefined or triggered by explicit signals.
   - **Impact**: Agent-Squad is more flexible but less auditable.
   - **Solution**: Predefine role catalog; route only within allowed role-to-role transitions (explicit handoff graph).

3. **Agent Autonomy (Implicit)**
   - **Agent-Squad**: Each agent can maintain independent state, tools, and logic.
   - **Our Model**: Agents are tools; Supervisor owns state and orchestration.
   - **Impact**: Agent-Squad assumes agent agency; we assume agent is passive executor.
   - **Solution**: Enforce agents as stateless, tool-like processors; keep all state in Supervisor.

4. **Conversation History as Agent Context**
   - **Agent-Squad**: Agent automatically fetches its conversation history.
   - **Our Model**: Agents receive curated, read-only state snapshots; no direct state access.
   - **Impact**: Agent-Squad allows agents to build context over time; ours is snapshot-based.
   - **Solution**: Keep snapshot model for safety; can add optional history injection per role if needed (but keep it controlled).

5. **No Explicit Approval Gates**
   - **Agent-Squad**: Orchestrator routes → agent processes → stores → returns.
   - **Our Model**: Validation gates, maker-checker, optional human approvals.
   - **Impact**: Agent-Squad is faster but less controlled for high-risk operations.
   - **Solution**: Add checkpoint hooks after agent response; gate progression via validator + optional approval.

---

## Concrete Hooks for MVP Integration

### 1. Replace Classifier with Rule-Based Router
- Keep Agent-Squad's orchestrator abstraction.
- Swap LLM classifier for deterministic router:
  - Input: request + intent keywords + provider CB state + error history.
  - Rules: intent → role mapping; fallback chain per role.
  - Output: selected agent (role) + reasoning log.
- **File Hook**: New `RuleBasedClassifier` or `DeterministicRouter` class; feeds to Orchestrator.

### 2. Formalize Agent Abstraction
- Agent-Squad's unified interface (`processRequest()`) is strong; keep it.
- Enforce in our provider adapter:
  - Input: `{ role, prompt, context_snapshot, acceptance_criteria }`.
  - Output: `{ result, status, evidence, tokens_used, provider_used, elapsed_ms }`.
  - Reject non-conforming payloads (message contracts).
- **File Hook**: Enforce schema validation in `cliAdapter.processRequest()`.

### 3. Dual-Level Storage (Formalize)
- Classifier context: Global state snapshots + routing decisions (log all reasons).
- Agent context: Per-role conversation history (optional; can be stateless).
- Storage backends: DragonflyDB (our current choice) or custom adapter.
- **File Hook**: Add `ClassifierStorage` and `AgentStorage` layers in state manager.

### 4. Per-User/Session Scoping
- User ID + Session ID as routing key.
- Isolate each user's state, queue, and audit logs.
- **File Hook**: Add `userId` and `sessionId` fields to task config; scope all state queries.

### 5. Retrievers Pattern (Context Management)
- Formalize context injection as "retrievers."
- Role-scoped retriever: pulls allowed state/files; redacts secrets.
- **File Hook**: Extend `promptBuilder` to use retriever pattern; define role-specific context policies.

### 6. Orchestrator Error Handling + Fallback
- Adopt Agent-Squad's error categorization and fallback precedence.
- Circuit breaker per provider; ordered fallback list.
- **File Hook**: Enhance `dispatcher` with error classification and multi-level fallback.

### 7. Validation Checkpoints (Explicit)
- Post-response validator gate (not in Agent-Squad baseline).
- Acceptance criteria check before state mutation.
- Optional human approval hook.
- **File Hook**: Insert validator between agent response and storage.

---

## Orchestrator Configuration & API (Agent-Squad Details)

### Configuration Interface: `AgentSquadConfig`

Agent-Squad exposes a rich configuration interface for fine-grained control. Here's the complete set:

| Config Property | Type | Default | Purpose |
|---|---|---|---|
| `LOG_AGENT_CHAT` | boolean | false | Log conversation with agents |
| `LOG_CLASSIFIER_CHAT` | boolean | false | Log conversation with intent classifier |
| `LOG_CLASSIFIER_RAW_OUTPUT` | boolean | false | Log raw (unprocessed) classifier output |
| `LOG_CLASSIFIER_OUTPUT` | boolean | false | Log processed/structured classifier output |
| `LOG_EXECUTION_TIMES` | boolean | false | Log timing for each operation |
| `MAX_RETRIES` | number | 3 | Retry attempts if classifier returns invalid XML |
| `MAX_MESSAGE_PAIRS_PER_AGENT` | number | 100 | Max conversation history size (pairs = 2 messages) |
| `USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED` | boolean | true | Fallback to default agent if no agent selected |
| `NO_SELECTED_AGENT_MESSAGE` | string | "I'm sorry, I couldn't determine how to handle your request. Could you please rephrase it?" | Error message when no agent identified (if fallback disabled) |
| `CLASSIFICATION_ERROR_MESSAGE` | string | undefined | Error message if classifier encounters internal error |
| `GENERAL_ROUTING_ERROR_MSG_MESSAGE` | string | undefined | Generic error message for unexpected failures |

### Initialization Example

#### TypeScript
```typescript
import { AgentSquad, BedrockLLMAgent, LexBotAgent } from "agent-squad";

const orchestrator = new AgentSquad({
  config: {
    LOG_AGENT_CHAT: true,
    LOG_CLASSIFIER_CHAT: true,
    LOG_EXECUTION_TIMES: true,
    MAX_RETRIES: 3,
    USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED: true,
    MAX_MESSAGE_PAIRS_PER_AGENT: 10,
  },
  storage: undefined, // defaults to InMemoryChatStorage; can provide DynamoDBChatStorage
  classifier: undefined, // defaults to BedrockClassifier; can provide custom
  logger: console,
});

// Add agents to the orchestrator
const travelAgent = new BedrockLLMAgent({
  name: "Travel Agent",
  description: "Handles travel bookings and itinerary planning.",
  streaming: false,
});

orchestrator.addAgent(travelAgent);
orchestrator.setDefaultAgent(travelAgent); // Fallback agent
```

#### Python
```python
from agent_squad.orchestrator import AgentSquad, AgentSquadConfig
from agent_squad.agents import BedrockLLMAgent, BedrockLLMAgentOptions
from agent_squad.storage import InMemoryChatStorage
from agent_squad.utils.logger import Logger

orchestrator = AgentSquad(
    options=AgentSquadConfig(
        LOG_AGENT_CHAT=True,
        LOG_CLASSIFIER_CHAT=True,
        LOG_EXECUTION_TIMES=True,
        MAX_RETRIES=3,
        USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED=True,
        MAX_MESSAGE_PAIRS_PER_AGENT=10,
    ),
    storage=InMemoryChatStorage(),
    classifier=None,  # Defaults to BedrockClassifier
    logger=Logger(),
)

# Add agents
travel_agent = BedrockLLMAgent(
    BedrockLLMAgentOptions(
        name="Travel Agent",
        description="Handles travel bookings and itinerary planning.",
        streaming=False,
    )
)
orchestrator.add_agent(travel_agent)
orchestrator.set_default_agent(travel_agent)
```

### Core API Functions

#### 1. `addAgent(agent)` / `add_agent(agent)`
- **Purpose**: Register a new agent with the orchestrator.
- **Why**: Expands the orchestrator's capability to handle new domains or tasks.
- **Example Use Case**: Adding a weather agent after initializing with a travel agent.
- **Parameters**:
  - `agent: Agent` — The agent to register.
- **Error Handling**: Throws error if agent ID already exists.

#### 2. `getDefaultAgent()` / `get_default_agent()`
- **Purpose**: Retrieve the currently configured default agent.
- **Why**: Verify which agent is used as fallback when classifier fails.
- **Parameters**: None.
- **Returns**: `Agent` or `None` if not set.

#### 3. `setDefaultAgent(agent)` / `set_default_agent(agent)`
- **Purpose**: Set the fallback agent for unclassified requests.
- **Why**: Ensure users always get a response (when `USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED` is `true`).
- **Parameters**:
  - `agent: Agent` — The agent to use as default.

#### 4. `getAllAgents()` / `get_all_agents()`
- **Purpose**: List all registered agents with metadata.
- **Why**: Debug, display agent list to users, or validate agent inventory.
- **Returns**: 
  - **TypeScript**: `{ [key: string]: { name: string; description: string } }`
  - **Python**: `Dict[str, Dict[str, str]]`
- **Example**:
  ```typescript
  const agents = orchestrator.getAllAgents();
  Object.entries(agents).forEach(([id, info]) => {
    console.log(`${id}: ${info.name} - ${info.description}`);
  });
  ```

#### 5. `routeRequest(userInput, userId, sessionId, additionalParams?, stream?)` / `route_request(...)`
- **Purpose**: Main function for processing user requests end-to-end.
- **Flow**:
  1. **Classify**: Analyze intent based on user input + agent descriptions + conversation history.
  2. **Route**: Select best-fitting agent.
  3. **Process**: Execute agent's `processRequest()`.
  4. **Store**: Save conversation to storage.
  5. **Return**: Response (streaming or full).
- **Why**: Encapsulates entire orchestration pipeline; single entry point.
- **Parameters**:
  - `userInput: string` — The user's message.
  - `userId: string` — Unique user identifier.
  - `sessionId: string` — Unique session identifier (isolates conversation context).
  - `additionalParams?: Record<string, any>` — Extra metadata (e.g., `{ priority: "high", location: "NYC" }`).
  - `stream?: boolean` — Whether to stream agent response or wait for full response.
- **Returns**:
  - **TypeScript**: `Promise<AgentResponse>` with `{ metadata, output, streaming, thinking? }`.
  - **Python**: `AgentResponse` with metadata, output (ConversationMessage or AsyncIterable), and streaming flag.
- **Example**:
  ```typescript
  const response = await orchestrator.routeRequest(
    "Book me a flight to Paris next week",
    "user123",
    "session456",
    { priority: "high" }
  );
  
  if (response.streaming) {
    for await (const chunk of response.output) {
      process.stdout.write(chunk);
    }
  } else {
    console.log(response.output);
  }
  ```

### Request Processing Pipeline (High-Level)

When `routeRequest()` is called, the orchestrator executes the following phases:

#### Phase 1: Classification
- **Input**: `userInput`, conversation history (from storage).
- **Classifier Role**: Analyzes intent; compares against all registered agents' descriptions.
- **Output**: `ClassifierResult` with `selectedAgent` (or `null` if no match).
- **Retry Logic**: If classifier returns invalid XML, retry up to `MAX_RETRIES` times.

#### Phase 2: Routing/Execution
- **Check Agent Selection**:
  - If agent selected, proceed to Phase 3.
  - If no agent and `USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED` is `true`, use default agent.
  - If no agent and `USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED` is `false`, return `NO_SELECTED_AGENT_MESSAGE`.
- **Fetch Chat History**: Retrieve agent-specific conversation history (up to `MAX_MESSAGE_PAIRS_PER_AGENT * 2` messages).
- **Execute Agent**: Call `selectedAgent.processRequest(userInput, userId, sessionId, chatHistory, additionalParams)`.

#### Phase 3: Response Generation
- **Agent Output**: Receive ConversationMessage or AsyncIterable (streaming).
- **Streaming vs. Non-Streaming**:
  - If streaming enabled: Return AsyncIterable; accumulate in background for storage.
  - If non-streaming: Wait for full response; store immediately.

#### Phase 4: Storage
- **Save User Input**: Store user message in agent-specific history.
- **Save Agent Response**: Store agent message in agent-specific history.
- **Scoping**: All messages isolated by `userId` + `sessionId` + `agentId`.
- **Truncation**: If history exceeds `MAX_MESSAGE_PAIRS_PER_AGENT * 2`, trim oldest messages.

#### Phase 5: Error Handling
- **Classification Error**: Log and return `CLASSIFICATION_ERROR_MESSAGE`.
- **Agent Processing Error**: Log and return `GENERAL_ROUTING_ERROR_MSG_MESSAGE`.
- **Storage Error**: Log but attempt to return response anyway.

### Storage Architecture

Agent-Squad supports pluggable storage backends:

- **InMemoryChatStorage** (default): Conversation history in memory; lost on restart.
- **DynamoDBChatStorage**: Persistent storage in AWS DynamoDB; per-user/session scoped.
- **Custom Storage**: Implement `ChatStorage` interface for custom backends (e.g., DragonflyDB, PostgreSQL).

**Dual-Level Context**:
1. **Classifier Context**: Global state snapshots used by intent classifier to make routing decisions.
2. **Agent Context**: Per-agent conversation history; agents see only their own messages (isolated per `userId`, `sessionId`, `agentId`).

### Response Metadata

Every response includes `RequestMetadata`:

```typescript
// TypeScript
interface RequestMetadata {
  userInput: string;
  userId: string;
  sessionId: string;
  agentId: string;
  agentName: string;
  additionalParams: Record<string, string>;
  errorType?: "classification_failed" | "agent_error" | "storage_error" | etc;
}
```

```python
# Python
@dataclass
class AgentProcessingResult:
    user_input: str
    user_id: str
    session_id: str
    agent_id: str
    agent_name: str
    additional_params: Dict[str, str]
    error_type: Optional[str] = None
```

This metadata enables full audit trails: who, what, when, which agent handled it, and any errors.

---

## What We Pick (MVP Best-Fit Concepts)

1. **Orchestrator Abstraction**: Cleaner separation of orchestration logic; validates our design.
2. **Unified Agent Interface**: Standardized input/output; simplifies provider swapping.
3. **Dual-Level Storage**: Formalize classifier vs. agent context separation; validates architecture.
4. **Per-User/Session Scoping**: Explicit multi-tenancy support.
5. **Retrievers Pattern**: Cleaner naming for context injection; role-scoped data policies.
6. **Error Handling + Fallback Abstraction**: Formalized error categories and precedence.

## What We Avoid (Deviations)

1. **LLM Classifier**: Replace with rule-based router; retain determinism.
2. **Dynamic Agent Discovery**: Predefine role catalog; static routing graph.
3. **Agent Autonomy**: Enforce agents as stateless executors; Supervisor owns state.
4. **Agent Conversation History as Default**: Keep snapshot-based; optional history injection under explicit control.
5. **Implicit Fallback**: Make fallback explicit via rules and logging; every fallback is auditable.

---

## Recommended MVP Actions

1. **Define RuleBasedClassifier**: Intent keywords + error patterns + CB state → role selection.
   - Input: request, history, provider states.
   - Output: selected role, reasoning log.
   - Test: Verify determinism and coverage for all intent classes.

2. **Enforce Agent IO Contracts**: Standardize input/output schemas per role.
   - Reject non-conformant payloads before dispatch and after return.
   - Log all rejections (potential tampering or bugs).

3. **Add Retriever Pattern**: Formalize context pulling per role.
   - Role-scoped allowlists for state/files.
   - Secret redaction in retriever, not at dispatch time.
   - Test: Verify isolation between roles.

4. **Dual-Level Storage**: Separate classifier vs. agent storage.
   - Classifier: Global routing decisions + intent logs.
   - Agent: Optional per-role conversation history (disable if not needed).
   - Test: Verify per-user/session isolation.

5. **Add Validation Checkpoint**: Post-response gate.
   - Acceptance criteria validation.
   - Optional human approval for high-risk roles.
   - Test: Verify gate blocks invalid outputs and gates approvals correctly.

6. **Error Classification & Fallback Precedence**: Formalize error handling.
   - Error types: transient (retry), provider (fallback), validation (halt), unknown (escalate).
   - Fallback list per role; log which was chosen and why.
   - Test: Verify correct recovery paths for each error type.

---

## Risk Mitigation

- **LLM Drift in Classifier**: Avoid by using rule-based router; no LLM routing at all.
- **Agent Autonomy Creep**: Enforce agents as functions, not entities; all state mutations via Supervisor.
- **Context Leakage**: Per-user/session scoping + retriever allowlists prevent cross-talk.
- **Loss of Determinism**: Rule-based routing + explicit logging + validation gates maintain reproducibility.

---

## Cross-References

- Governance & guardrails: ../governance-observability-enhancement.md, ../guardrails.md
- Core principles: ../../VALIDATION.md, ../../LOGGING.md, ../../STATE_ACCESS.md, ../../SANDBOX.md, ../../PROMPT.md
- MAO roadmap: ../INDEX.md, ../extensions.md, ../roadmap.md
- Architectural foundation: ../../ARCHITECTURE.md, ../../LOOP.md
- Related temp docs: ms-patterns.md, ibm-hierarchical-alignment.md, multiagent-planning-gfg.md

---

## Summary

Agent-Squad is a well-designed, production-grade orchestration framework. Its core abstractions (Orchestrator, unified Agent interface, dual-level storage, retrievers) align well with our architecture. However, its LLM-based classifier and implicit agent autonomy conflict with our deterministic, operator-controlled model. By adopting its abstractions while replacing the classifier with rule-based routing and enforcing agents as stateless executors, we gain a cleaner, more formalized architecture without sacrificing determinism or auditability. This is a **high-value integration** with **manageable deviations**.

