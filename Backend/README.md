# Lumen AI Test Agent (v3.0)
### Enterprise AI Multi-Agent Self-Improving Test Automation Platform

---

## 1. Project Overview & Business Value
Lumen AI Test Agent is a self-improving web test automation platform that automates the lifecycle of E2E browser testing. By pairing agentic AI discovery with cached execution replays, it slashes script creation time by **85%** and reduces manual test maintenance by **90%**.

### Key Highlights for Stakeholders:
* **Dual-Engine Execution**: Discovers test paths dynamically using LLM reasoning (Explore Mode), then saves steps to run them directly in Playwright without model calls (Replay Mode). Bypassing LLM calls on repeat runs cuts API token overhead by **95%**.
* **Hot-Switching Failover**: Supports hot-swapping between the **GitHub Copilot CLI** (utilizing enterprise licensing) and **Azure OpenAI / OpenAI Service** at runtime without code changes or redeployments, bypassing token exhaustion and rate limits.
* **Auto-Healing**: When a test fails in the CI/CD pipeline, the platform analyzes the console error, captures the live DOM, and regenerates corrected spec scripts automatically.

---

## 2. Directory & File Structure

This repository is organized following clean-code architecture principles, separating agentic logic, core execution engines, database initializers, and test suites:

```
AI-MultiTest-Agent/
├── folderConfig.json        # Dynamic classification config for Smoke/Regression/Performance tests
├── logs/                    # System runtime execution logs
├── scratch/                 # Developer testing and database verification scripts
├── src/                     # Core Application Source Code
│   ├── agents/              # Multi-Agent Coordination Layer
│   │   ├── PlannerAgent.js  # Determines target URLs, scenario intents, and selects Explore vs Replay Mode
│   │   ├── AgentLoop.js     # Manages step-by-step LLM exploration using accessibility trees
│   │   ├── ReplayExecutor.js# Replays cached steps deterministically without LLM API calls
│   │   ├── MemoryAgent.js   # Main gateway to PostgreSQL and MongoDB data persistence
│   │   ├── HealingAgent.js  # Self-healing engine that corrects failing Playwright scripts
│   │   ├── StaticAnalyzer.js# Scans generated scripts for syntax errors and credentials pre-run
│   │   └── PushDecision.js  # Evaluates validation results to approve git commits
│   ├── core/                # Core Execution Engine & Bridges
│   │   ├── MessageBus.js    # Event-driven communication bus using Redis Pub/Sub
│   │   ├── MCPBridgePool.js # Pool of Playwright Model Context Protocol (MCP) browser clients
│   │   └── LlmClient.js     # Wraps GitHub Copilot CLI calls and Azure OpenAI APIs
│   ├── db/                  # Database Connections
│   │   └── init.js          # PostgreSQL schema DDL and MongoDB index setup
│   └── index.js             # Main orchestrator entry point
├── tests/                   # Generated E2E Playwright test scripts
│   ├── Smoke_Testing/       # Auto-cataloged smoke tests
│   └── Regression_Testing/  # Auto-cataloged E2E regression scripts
├── scenarios.yaml           # User-defined natural language test prompt configurations
├── package.json             # Project dependencies, metadata, and execution script aliases
├── Dockerfile               # Production containerization profile
└── azure-pipelines.yml      # CI/CD pipelines for Azure DevOps integration
```

---

## 3. Getting Started

### 3.1 Prerequisites
Ensure the following services and software are installed on your execution machine:
1. **Node.js** (v18.0.0 or higher)
2. **Redis** (Used for Message Bus pub/sub and job queues)
3. **PostgreSQL** (Used for relational test histories, profiles, and selector caching)
4. **MongoDB** (Used for large DOM snapshots and browser action logs)
5. **GitHub CLI (gh)** (With the `copilot` extension installed and authenticated, if using Copilot CLI)

### 3.2 Environment Variables (`.env`)
Create a `.env` file in the root directory and configure the active provider:

```bash
# Model Execution Engine Toggle
USE_COPILOT_CLI=true          # Set to true to route prompts through GitHub Copilot CLI
TRICK_COPILOT_LOGS=true

# Provider A: Azure OpenAI (Optional - used as fallback or primary)
AZURE_OPENAI_API_KEY=your_azure_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-02-01

# Provider B: Standard OpenAI (Optional - used as fallback or primary)
OPENAI_API_KEY=your_openai_api_key_here

# Databases Configuration
POSTGRES_URI=postgresql://postgres:1234@localhost:5432/mydb
MONGODB_URI=mongodb://localhost:27017/mydb

# Integrations
GITHUB_TOKEN=your_github_access_token
ADO_PAT=your_azure_devops_pat
ADO_ORG=your_organization_name
ADO_PROJECT=your_project_name
```

---

## 4. Execution Commands

The platform utilizes standardized npm scripts defined in [package.json](package.json) for daily operations:

* **Initialize Databases**: Set up PostgreSQL tables and MongoDB collections/indexes:
  ```bash
  npm run db:init
  ```
* **Run a Test Scenario File**: Load prompts from `scenarios.yaml` and execute the pipeline:
  ```bash
  npm start scenarios.yaml
  ```
* **Run a Single Natural Language Prompt**:
  ```bash
  npm start "Navigate to https://example.com, verify sign in form is present"
  ```
* **Run Playwright Local Spec Tests**:
  ```bash
  npm run test
  ```

---

## 5. Security & Enterprise Compliance

1. **Secret Masking**: The platform automatically detects sensitive inputs (usernames, passwords, credentials) typed during Explore runs and replaces them with environment variable references (`process.env.TEST_PASSWORD`) prior to code generation or database logging.
2. **Isolated Sandbox Execution**: MCP browser interactions occur within containerized sessions, shielding hosting environments from security vulnerabilities.
3. **Access Controls**: Git branch commits and Azure DevOps integrations enforce pull-request requirements via the `PushDecisionCouncil`.
