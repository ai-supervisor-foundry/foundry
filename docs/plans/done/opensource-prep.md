# Open Source Preparation Plan

**Status:** Proposed
**Date:** 2026-01-09

## 1. Repository Tags (Topics)
To improve discoverability on GitHub, we propose adding the following topics to the repository:

```text
ai-agents
autonomous-development
software-factory
control-plane
llm-orchestration
devops-automation
cursor-ai
gemini-api
copilot-cli
claude-code
ollama-phi4-mini
typescript
redis
foundry
```

## 2. Open Source Assets
To meet community standards and enable safe contribution, we need to generate the following files:

### A. LICENSE
*   **Proposal:** **MIT License**.
*   **Reasoning:** Permissive, standard for developer tools, encourages adoption and contribution without legal friction.

### B. CONTRIBUTING.md
*   **Content:**
    *   Prerequisites (Node, Docker/Redis).
    *   Setup instructions (`npm install`, `docker-compose up`).
    *   Running tests (`npm test`).
    *   Architecture overview (link to `docs/ARCHITECTURE.md`).
    *   Pull Request process.

### C. CODE_OF_CONDUCT.md
*   **Proposal:** Standard **Contributor Covenant v2.1**.

### D. SECURITY.md
*   **Content:** Instructions to report vulnerabilities privately (e.g., email or GitHub Security Advisories) instead of public issues.

### E. .github/ISSUE_TEMPLATE/
*   `bug_report.md`: Structured inputs for reproduction steps.
*   `feature_request.md`: Structured inputs for use cases.

## 3. Beta Disclaimer (Visuals)
We will add a prominent warning at the top of the `README.md` using GitHub's **Alert Markdown** syntax, which renders as a colored box.

### Proposed Markdown:

```markdown
> [!WARNING]
> **Public Beta Notice**
> 
> Foundry is currently in **Active Beta**. While the core control loop and state persistence are stable, internal APIs and task schemas may evolve. 
> 
> **Use with caution** in production environments. We recommend monitoring execution via the `audit.log` or verbose logs.
```

### Proposed Badge Status (Top of README)
```markdown
![Status](https://img.shields.io/badge/Status-Beta-orange)
![License](https://img.shields.io/badge/License-MIT-blue)
![Build](https://img.shields.io/badge/Build-Passing-brightgreen)
```

## 4. Execution Steps
1.  Approve this plan.
2.  Generate `LICENSE` (MIT).
3.  Generate `CONTRIBUTING.md`.
4.  Generate `CODE_OF_CONDUCT.md`.
5.  Update `README.md` with:
    *   Badges.
    *   Beta Warning Box.
    *   Links to new assets.
