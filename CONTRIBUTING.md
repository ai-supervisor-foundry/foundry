# Contributing to Foundry

Thank you for your interest in contributing to Foundry! We welcome contributions from the community to help make this the standard for autonomous AI software factories.

## Prerequisites

Before you start, ensure you have the following installed:

*   **Node.js**: LTS version (v18+ recommended).
*   **Docker & Docker Compose**: Required for running DragonflyDB (state & queue storage).
*   **Provider CLIs**: Depending on what you are testing, you may need `gemini`, `copilot`, or `cursor` CLIs installed.

## Getting Started

1.  **Fork and Clone the repository**:
    ```bash
    git clone https://github.com/YOUR_USERNAME/foundry.git
    cd foundry
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Start Infrastructure**:
    Start the local DragonflyDB instance.
    ```bash
    docker-compose up -d
    ```

## Development Workflow

### Running in Development Mode
You can run the CLI directly using `tsx`:

```bash
# Initialize state
npm run cli -- init-state --execution-mode MANUAL

# Check status
npm run cli -- status
```

### Running Tests
We use Jest for testing. Please ensure all tests pass before submitting a PR.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Architecture
Please familiarize yourself with the core architecture before making major changes.
*   **[Architecture Overview](docs/ARCHITECTURE.md)**: Role separation and core components.
*   **[Control Loop](docs/LOOP.md)**: How the main orchestration loop functions.
*   **[Tool Contracts](docs/TOOL_CONTRACTS.md)**: How Foundry interacts with external AI agents.

## Pull Request Process

1.  **Branching**: Create a new branch for your feature or bug fix (`feature/my-feature` or `fix/bug-issue`).
2.  **Commit Messages**: Use clear, descriptive commit messages.
3.  **Tests**: Add unit tests for new logic. Ensure existing tests pass.
4.  **Documentation**: Update `README.md` or `docs/` if you change behavior or add features.
5.  **Submit**: Open a Pull Request against the `main` branch.

## Code Style
*   We use TypeScript.
*   Follow the existing patterns for dependency injection and logging.
*   Ensure rigorous typing (avoid `any` where possible).

## Community
By participating in this project, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
