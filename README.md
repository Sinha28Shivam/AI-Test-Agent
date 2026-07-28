# Lumen AI Test Agent (v3.0) — Full-Stack Enterprise Platform

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-v1.60-blue.svg)](https://playwright.dev/)
[![React](https://img.shields.io/badge/React-v18-cyan.svg)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express.js-v4-lightgrey.svg)](https://expressjs.com/)

**Lumen AI Test Agent** is an enterprise-grade, self-improving web test automation platform that pairs agentic AI discovery with cached execution replays to reduce test script creation time by **85%** and manual script maintenance by **90%**.

---

## 🌟 Key Architecture & Highlights

* **Dual-Engine Execution**:
  * **Explore Mode**: Dynamically navigates accessibility DOM trees using LLMs (GitHub Copilot CLI, Azure OpenAI, or OpenAI API).
  * **Replay Mode**: Saves distilled action sequences to execute directly in Playwright without model calls (bypassing LLM calls cuts API token overhead by **95%**).
* **Hot-Switching LLM Failover**: Hot-swaps between GitHub Copilot CLI, Azure OpenAI, and OpenAI API at runtime without code redeployments to avoid rate limits and token exhaustion.
* **Auto-Healing Pipeline**: Intercepts Playwright execution errors, captures live page DOM states, and auto-corrects broken spec scripts up to 2 times automatically.
* **Full-Stack Management Console**:
  * **Express + Socket.io Backend** (`Backend/`): Exposes REST APIs and streams real-time agent execution logs via WebSockets.
  * **React + Vite Dark UI Dashboard** (`Frontend/`): Modern dark-themed dashboard featuring real-time terminal logs, live Playwright DOM canvas preview, metric overview cards, and interactive spec code viewers.

---

## 📁 Repository Directory Structure

```
AI-MultiTest-Agent/
├── Backend/                         # Node.js + Express API Server & Core Multi-Agent Orchestrator
│   ├── server.js                    # Express + Socket.io Server Entry Point
│   ├── package.json                 # Backend Dependencies & Scripts
│   ├── .env                         # Environment Configuration & API Keys
│   ├── folderConfig.json            # Dynamic classification rules (Smoke, Regression, Performance)
│   ├── scenarios.yaml               # Natural language test prompt scenario configurations
│   ├── src/                         # Multi-Agent Application Source Code
│   │   ├── agents/                  # Specialized Multi-Agent Layer
│   │   │   ├── PlannerAgent.js      # Determines scenario intent & picks Explore vs. Replay
│   │   │   ├── AgentLoop.js         # Manages LLM accessibility navigation loop
│   │   │   ├── ReplayExecutor.js    # Replays cached steps deterministically
│   │   │   ├── MemoryAgent.js       # Persistence gateway for Postgres & MongoDB
│   │   │   ├── HealingAgent.js      # Self-healing engine for repairing broken Playwright scripts
│   │   │   ├── CodeGenerator.js     # Generates Playwright spec code
│   │   │   ├── StaticAnalyzerAgent.js# Pre-execution syntax & security validator
│   │   │   └── PushDecisionCouncil.js# Git branch commit approval gate
│   │   ├── core/                    # Infrastructure Bridges
│   │   │   ├── LlmClient.js         # Copilot CLI & Azure OpenAI failover wrapper
│   │   │   ├── MessageBus.js        # Redis Pub/Sub event bridge
│   │   │   └── MCPBridgePool.js     # Pool of Playwright MCP browser clients
│   │   └── db/
│   │       └── init.js              # PostgreSQL table DDL & MongoDB index initializer
│   └── tests/                       # Generated E2E Playwright Spec Files (.spec.js)
│       ├── Smoke_Testing/
│       └── Regression_Testing/
├── Frontend/                        # React + Vite Enterprise Dashboard UI
│   ├── index.html                   # HTML Entry Point
│   ├── package.json                 # Frontend Dependencies
│   ├── vite.config.js               # Vite Proxy & Build Config
│   ├── tailwind.config.js           # Stitch Design System Palette & Typography
│   └── src/                         # React UI Components
│       ├── main.jsx                 # React DOM Root
│       ├── App.jsx                  # Main Application Container & Socket Listeners
│       └── components/              # Stitch UI Dashboard Modules
│           ├── Header.jsx           # Top Navigation Command Bar
│           ├── Sidebar.jsx          # Futuristic Navigation Rail
│           ├── TestLauncher.jsx     # Scenario Prompt Launcher Console
│           ├── ExecutionMonitor.jsx # Dual-Pane Real-Time Terminal & Live DOM View
│           ├── MetricsOverview.jsx  # Performance & Token Savings Cards
│           └── RecentRunsTable.jsx  # Historical Runs Grid & Spec Code Modal
└── README.md                        # Full Project Documentation & Setup Guide
```

---

## 🛠️ System Prerequisites

Ensure the following tools and services are installed on your machine before running:

1. **Node.js** (v18.0.0 or higher)
2. **PostgreSQL** (v12+ running on `localhost:5432` with user `postgres`)
3. **MongoDB** (v5+ running on `localhost:27017`)
4. **Redis** (v6+ running on `localhost:6379`)

---

## 🚀 Step-by-Step Setup Guide

### Step 1: Database Setup
Make sure PostgreSQL and MongoDB services are active. Initialize the relational tables and document indexes:

```bash
cd Backend
node src/db/init.js
```

*(Note: `src/db/init.js` automatically creates tables `domain_profiles`, `action_sequences`, `run_history`, `failure_log`, etc. in PostgreSQL `mydb` and indexes in MongoDB `mydb`.)*

---

### Step 2: Backend Configuration (`Backend/.env`)
Verify or adjust your `Backend/.env` file with appropriate API keys and database strings:

```env
# Server Ports
PORT=3000
BACKEND_PORT=5000

# Database URIs
POSTGRES_URI=postgresql://postgres:1234@localhost:5432/mydb
MONGODB_URI=mongodb://localhost:27017/mydb
REDIS_URI=redis://localhost:6379

# LLM Providers
USE_COPILOT_CLI=false
AZURE_OPENAI_API_KEY=your_azure_key_here
AZURE_OPENAI_ENDPOINT=https://your-endpoint.cognitiveservices.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Reporting Options (allure | azure | html)
REPORTER_TYPE=allure
```

---

### Step 3: Install Dependencies

#### Backend:
```bash
cd Backend
npm install
```

#### Frontend:
```bash
cd Frontend
npm install
```

---

## 💻 Running the Application

### 1. Launch the Express Backend API & WebSocket Server
```bash
cd Backend
npm start
```
*Backend server will start at **`http://localhost:5000`**.*

### 2. Launch the React Frontend Dashboard
In a separate terminal window:
```bash
cd Frontend
npm run dev
```
*Frontend UI dashboard will be accessible at **`http://localhost:5173`**.*

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/stats` | Aggregate execution stats (success rate, avg duration, token savings) |
| `GET` | `/api/runs` | Historical list of test execution runs |
| `POST` | `/api/runs` | Trigger a new test run from natural language prompt |
| `GET` | `/api/domains` | Domain volatility profiles and step count averages |
| `GET` | `/api/scripts` | List generated `.spec.js` Playwright test files |
| `GET` | `/api/scripts/content` | View code content of a specific `.spec.js` script |
| `GET` | `/api/logs` | Fetch real-time buffered terminal log events |

---

## 🔐 Security & Enterprise Compliance

1. **Secret Masking**: Sensitive inputs (passwords, auth tokens, API credentials) typed during Explore runs are masked and converted to environment variable references (`process.env.TEST_PASSWORD`) prior to code generation.
2. **Containerized MCP Browser Sessions**: MCP browser interactions execute inside isolated browser contexts.
3. **Quality Gates**: Every auto-generated script undergoes static syntax checking and Push Decision Council approval before repository commits.
