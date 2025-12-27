# Logic Apps AI Assistant - Design Document

## Executive Summary

This document describes the design for a Logic Apps AI Assistant that helps users debug, author, and manage Azure Logic Apps through natural language. The solution is offered in two deployment models to serve different customer segments.

---

## Customer Segments

### Segment 1: Enterprise with AI Subscriptions
- **Profile**: Organizations with GitHub Copilot, Claude, Cursor, or similar AI tools
- **LLM**: Already paid for via existing subscriptions
- **Solution**: MCP Server (local, npm package)
- **Cost to customer**: None (uses their existing AI subscription)

### Segment 2: No AI Subscription
- **Profile**: Organizations with Azure subscription but no AI assistant tools
- **LLM**: Pay-per-use via Azure AI Foundry
- **Solution**: Logic Apps Agent Loop (cloud-hosted)
- **Cost to customer**: Azure AI Foundry consumption + Logic Apps Standard

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SHARED KNOWLEDGE BASE                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  GitHub Repository (Public)                                          │   │
│  │  └── docs/                                                           │   │
│  │      ├── troubleshooting/  (expression-errors, connections, etc.)   │   │
│  │      ├── authoring/        (patterns, connectors, deployment)       │   │
│  │      └── reference/        (tool catalog, SKU differences)          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                   │
                    ▼                                   ▼
┌───────────────────────────────────┐   ┌───────────────────────────────────┐
│  SOLUTION 1: MCP Server           │   │  SOLUTION 2: Agent Loop           │
│  (Segment 1 - Enterprise AI)      │   │  (Segment 2 - No AI)              │
├───────────────────────────────────┤   ├───────────────────────────────────┤
│  Runtime: User's AI Assistant     │   │  Runtime: Logic Apps Standard     │
│  LLM: Claude/GPT-4/etc (theirs)   │   │  LLM: Azure AI Foundry (pay/use)  │
│  Transport: stdio (local)         │   │  Transport: Built-in agent loop   │
│  Auth: User's az login            │   │  Auth: Managed Identity           │
│  Frontend: Claude/Copilot/Cursor  │   │  Frontend: Built-in Chat UI       │
└───────────────────────────────────┘   └───────────────────────────────────┘
```

---

# SOLUTION 1: MCP Server

## Overview

An npm package that implements the Model Context Protocol, enabling any MCP-compatible AI assistant to interact with Azure Logic Apps.

## Distribution

| Channel | Purpose |
|---------|---------|
| npm | `@laveeshb/logicapps-mcp` - Primary distribution |
| GitHub MCP Registry | Discoverability for VS Code users |
| Smithery.ai | Discoverability for Claude/Cursor users |
| mcp-get | One-command install for Claude Desktop |

## Installation

```bash
# Via npx (recommended)
npx -y @laveeshb/logicapps-mcp

# Via npm global install
npm install -g @laveeshb/logicapps-mcp
logicapps-mcp
```

## Configuration

### VS Code / GitHub Copilot

**User-level** (applies to all workspaces):
```
Command Palette → MCP: Open User Configuration
```

```json
{
  "servers": {
    "logicapps": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@laveeshb/logicapps-mcp"]
    }
  }
}
```

### Claude Desktop

```json
// %APPDATA%\Claude\claude_desktop_config.json
{
  "mcpServers": {
    "logicapps": {
      "command": "npx",
      "args": ["-y", "@laveeshb/logicapps-mcp"]
    }
  }
}
```

### Cursor

```json
// ~/.cursor/mcp.json
{
  "mcpServers": {
    "logicapps": {
      "command": "npx",
      "args": ["-y", "@laveeshb/logicapps-mcp"]
    }
  }
}
```

## Tool Architecture

### Layer 1: Logic Apps Operations (33 tools)

These tools directly interact with Azure Management APIs:

| Category | Tools | Description |
|----------|-------|-------------|
| **Discovery** | `list_subscriptions`, `list_logic_apps`, `list_workflows` | Find Logic Apps resources |
| **Inspection** | `get_workflow_definition`, `get_workflow_triggers`, `get_workflow_swagger` | Understand workflow structure |
| **Run History** | `list_run_history`, `search_runs`, `get_run_details`, `get_run_actions` | Investigate executions |
| **Debugging** | `get_action_io`, `get_action_repetitions`, `get_expression_traces`, `get_action_request_history` | Deep dive into failures |
| **Triggers** | `get_trigger_history`, `get_trigger_callback_url`, `run_trigger` | Trigger management |
| **Connections** | `get_connections`, `get_connection_details`, `test_connection`, `create_connection` | API connection management |
| **Connectors** | `get_connector_swagger`, `invoke_connector_operation` | Connector discovery |
| **Lifecycle** | `create_workflow`, `update_workflow`, `delete_workflow`, `enable_workflow`, `disable_workflow` | Workflow management |
| **Operations** | `cancel_run`, `get_host_status` | Runtime operations |
| **Versioning** | `list_workflow_versions`, `get_workflow_version` | Version history |

### Layer 2: Knowledge Tools (3 tools)

These tools provide access to bundled documentation:

```typescript
// Tool: get_troubleshooting_guide
{
  name: "get_troubleshooting_guide",
  description: "Get troubleshooting guidance for Logic Apps issues. Call this when debugging failed runs, expression errors, or connection problems.",
  parameters: {
    topic: {
      type: "string",
      enum: ["expression-errors", "connection-issues", "run-failures", "known-limitations"],
      description: "The troubleshooting topic"
    }
  }
}

// Tool: get_authoring_guide  
{
  name: "get_authoring_guide",
  description: "Get guidance for creating and modifying Logic Apps workflows. Call this when helping users build workflows, use connectors, or deploy.",
  parameters: {
    topic: {
      type: "string", 
      enum: ["workflow-patterns", "connector-patterns", "deployment"],
      description: "The authoring topic"
    }
  }
}

// Tool: get_reference
{
  name: "get_reference",
  description: "Get reference documentation for Logic Apps. Call this for tool usage details or SKU comparisons.",
  parameters: {
    topic: {
      type: "string",
      enum: ["tool-catalog", "sku-differences"],
      description: "The reference topic"
    }
  }
}
```

### Implementation

Knowledge tools read from bundled docs or fetch from GitHub:

```typescript
// Option A: Bundled (offline, versioned with package)
import { readFileSync } from 'fs';
import { join } from 'path';

function getTroubleshootingGuide(topic: string): string {
  const docPath = join(__dirname, '..', 'docs', 'troubleshooting', `${topic}.md`);
  return readFileSync(docPath, 'utf-8');
}

// Option B: GitHub fetch (always current)
async function getTroubleshootingGuide(topic: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/laveeshb/logicapps-mcp/main/docs/troubleshooting/${topic}.md`;
  const response = await fetch(url);
  return response.text();
}
```

**Recommendation**: Use bundled docs (Option A) for reliability, with version matching.

### Layer 3: MCP Prompts (2 prompts)

Pre-built prompts users can invoke for comprehensive guidance:

```typescript
// Prompt: logic-apps-guide
{
  name: "logic-apps-guide",
  description: "Comprehensive guide for working with Azure Logic Apps",
  // Returns condensed system prompt with key patterns
}

// Prompt: native-operations-guide
{
  name: "native-operations-guide", 
  description: "Guide for using native Logic Apps operations",
  // Returns reference for built-in actions
}
```

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│  User runs: az login                                        │
│  └── Creates ~/.azure/mcp_token_cache.json                  │
├─────────────────────────────────────────────────────────────┤
│  MCP Server starts                                          │
│  └── @azure/identity DefaultAzureCredential                 │
│      └── Reads cached credentials                           │
├─────────────────────────────────────────────────────────────┤
│  Tool called (e.g., list_logic_apps)                        │
│  └── Gets access token for ARM                              │
│  └── Calls Azure Management API                             │
│  └── Returns result to AI                                   │
└─────────────────────────────────────────────────────────────┘
```

## Package Structure

```
@laveeshb/logicapps-mcp/
├── package.json
├── README.md
├── dist/
│   ├── index.js          # Entry point
│   └── server.js         # MCP server implementation
├── docs/                  # Bundled documentation
│   ├── troubleshooting/
│   ├── authoring/
│   └── reference/
└── src/
    ├── index.ts
    ├── server.ts
    ├── tools/
    │   ├── logic-apps.ts    # 33 LA tools
    │   └── knowledge.ts     # 3 guide tools
    └── prompts/
        └── index.ts
```

## User Experience

```
User: "investigate the order-processor logic app for me"

AI Assistant:
├── Calls: list_logic_apps() → finds order-processor in rg-production
├── Calls: get_workflow_definition() → understands structure
├── Calls: search_runs(status='Failed', top=5) → finds recent failures  
├── Calls: get_run_actions(runId) → identifies failed action
├── Calls: get_action_io(runId, actionName) → gets error details
├── Calls: get_troubleshooting_guide('expression-errors') → gets guidance
└── Responds: "I found 3 failures in the last 24 hours. The Parse_JSON 
    action is failing because the input is null. Here's how to fix it..."
```

---

# SOLUTION 2: Logic Apps Agent Loop

## Overview

A cloud-hosted solution using Logic Apps Standard's built-in Agent Loop feature with Azure AI Foundry, providing a chat-based interface for users without AI subscriptions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Customer's Azure Subscription                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Logic Apps Standard - "logicapps-ai-assistant"                      │   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Workflow: "agent-loop"                                         │ │   │
│  │  │                                                                 │ │   │
│  │  │  Trigger: Agent Loop                                            │ │   │
│  │  │  ├── System Prompt: (condensed from docs)                       │ │   │
│  │  │  ├── LLM Connection: Azure AI Foundry                           │ │   │
│  │  │  └── Tools: (defined below)                                     │ │   │
│  │  │                                                                 │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  Identity: Managed Identity                                          │   │
│  │  └── Role: Reader on subscription (for listing Logic Apps)          │   │
│  │  └── Role: Logic App Contributor on target resource groups          │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Azure AI Foundry - "logicapps-ai-foundry"                           │   │
│  │  └── Deployment: gpt-4o                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    │ HTTPS (raw.githubusercontent.com)
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  GitHub (Public) - docs repository                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Tool Definitions

### Logic Apps Operations

Each tool is implemented as an HTTP action calling Azure Management APIs:

```json
{
  "tools": [
    {
      "name": "list_logic_apps",
      "description": "List all Logic Apps in a subscription or resource group. Returns both Consumption and Standard SKUs.",
      "parameters": {
        "type": "object",
        "properties": {
          "subscriptionId": {
            "type": "string",
            "description": "Azure subscription ID"
          },
          "resourceGroupName": {
            "type": "string",
            "description": "Optional: Filter by resource group"
          }
        },
        "required": ["subscriptionId"]
      },
      "implementation": {
        "type": "http",
        "method": "GET",
        "uri": "https://management.azure.com/subscriptions/@{parameters.subscriptionId}/providers/Microsoft.Logic/workflows?api-version=2019-05-01",
        "authentication": {
          "type": "ManagedIdentity",
          "audience": "https://management.azure.com"
        }
      }
    }
  ]
}
```

### Knowledge Tools

Fetch documentation from GitHub:

```json
{
  "name": "get_troubleshooting_guide",
  "description": "Get troubleshooting guidance for Logic Apps issues",
  "parameters": {
    "type": "object",
    "properties": {
      "topic": {
        "type": "string",
        "enum": ["expression-errors", "connection-issues", "run-failures", "known-limitations"]
      }
    },
    "required": ["topic"]
  },
  "implementation": {
    "type": "http",
    "method": "GET",
    "uri": "https://raw.githubusercontent.com/laveeshb/logicapps-mcp/main/docs/troubleshooting/@{parameters.topic}.md"
  }
}
```

## System Prompt

Condensed version of documentation (~500 lines / ~2K tokens):

```markdown
You are an Azure Logic Apps expert assistant. You help users debug, author, and manage Logic Apps.

## Your Capabilities
- List and inspect Logic Apps (Consumption and Standard SKUs)
- Investigate failed workflow runs
- Debug expressions, connections, and trigger issues
- Help create and modify workflows
- Explain SKU differences and best practices

## Debugging Workflow
When investigating a failed Logic App:
1. First, identify the Logic App using list_logic_apps
2. Get recent failed runs using search_runs with status='Failed'
3. Use get_run_actions to find which action failed
4. Use get_action_io to see the actual error message
5. If it's an expression error, call get_troubleshooting_guide('expression-errors')
6. If it's a connection issue, call get_troubleshooting_guide('connection-issues')

## Key Patterns
- Always check get_action_io for actual error details, not just action status
- For loops, use get_action_repetitions to see individual iterations
- For HTTP failures, use get_action_request_history for retry details
- Standard SKU requires workflowName parameter; Consumption doesn't

## When to Use Guide Tools
- get_troubleshooting_guide: When debugging errors, call with relevant topic
- get_authoring_guide: When helping create/modify workflows
- get_reference: When user asks about tools or SKU differences
```

## Deployment

### Prerequisites
- Azure subscription with:
  - Logic Apps Standard enabled
  - Azure AI Foundry with GPT-4o deployment
  - Managed Identity with appropriate permissions

### Deployment Options

#### Option A: ARM Template
```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "resources": [
    {
      "type": "Microsoft.Web/sites",
      "kind": "functionapp,workflowapp",
      "name": "logicapps-ai-assistant",
      "properties": {
        "siteConfig": {
          "appSettings": [
            {
              "name": "AZURE_AI_FOUNDRY_ENDPOINT",
              "value": "[parameters('aiFoundryEndpoint')]"
            }
          ]
        }
      }
    }
  ]
}
```

#### Option B: Bicep
```bicep
resource logicApp 'Microsoft.Web/sites@2022-09-01' = {
  name: 'logicapps-ai-assistant'
  kind: 'functionapp,workflowapp'
  properties: {
    // ...
  }
}
```

#### Option C: Azure Portal Wizard
Step-by-step deployment guide for non-technical users.

## User Experience

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Logic Apps Portal - Chat UI                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User: Why is my order-processor failing?                                   │
│                                                                             │
│  Assistant: I'll investigate the order-processor Logic App for you.         │
│                                                                             │
│  [Calling list_logic_apps...]                                               │
│  [Calling search_runs with status='Failed'...]                              │
│  [Calling get_run_actions...]                                               │
│  [Calling get_action_io...]                                                 │
│                                                                             │
│  I found the issue! The Parse_JSON action is failing because the HTTP       │
│  response body is null when the external API returns a 204 No Content.      │
│                                                                             │
│  Here's how to fix it:                                                      │
│  1. Add a condition after the HTTP action to check the status code          │
│  2. Only run Parse_JSON when status code is 200                             │
│  3. Handle 204 separately with a default response                           │
│                                                                             │
│  Would you like me to help you update the workflow definition?              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Security Considerations

### Managed Identity Permissions

Least privilege model:

| Scope | Role | Purpose |
|-------|------|---------|
| Subscription | Reader | List Logic Apps across resource groups |
| Target Resource Groups | Logic App Contributor | Manage workflows |
| Target Resource Groups | API Connection Contributor | Manage connections |

### Data Boundaries

- Agent only accesses Logic Apps in the customer's subscription
- System prompt contains no customer data
- Docs fetched from public GitHub (no secrets)
- All API calls authenticated via Managed Identity

---

# SHARED COMPONENTS

## Documentation Repository

Both solutions consume the same documentation:

```
docs/
├── troubleshooting/
│   ├── README.md              # Quick diagnosis flowchart
│   ├── expression-errors.md   # Null checks, type conversions, dates
│   ├── connection-issues.md   # OAuth, Managed Identity, auth patterns
│   ├── run-failures.md        # Action failures, triggers, loops
│   └── known-limitations.md   # Platform constraints + workarounds
├── authoring/
│   ├── README.md              # Authoring overview
│   ├── workflow-patterns.md   # Common workflow patterns
│   ├── connector-patterns.md  # SQL, Service Bus, Blob, Office 365
│   └── deployment.md          # ARM, Terraform, CI/CD
└── reference/
    ├── tool-catalog.md        # All tools with examples
    └── sku-differences.md     # Consumption vs Standard deep dive
```

**Current size**: ~3,600 lines (~15-20KB)

## Tool Parity

Both solutions implement the same 36 tools (33 operations + 3 guides):

| # | Tool Name | Category |
|---|-----------|----------|
| 1 | list_subscriptions | Discovery |
| 2 | list_logic_apps | Discovery |
| 3 | list_workflows | Discovery |
| 4 | get_workflow_definition | Inspection |
| 5 | get_workflow_triggers | Inspection |
| 6 | get_workflow_swagger | Inspection |
| 7 | list_run_history | Run History |
| 8 | search_runs | Run History |
| 9 | get_run_details | Run History |
| 10 | get_run_actions | Run History |
| 11 | get_action_io | Debugging |
| 12 | get_action_repetitions | Debugging |
| 13 | get_expression_traces | Debugging |
| 14 | get_action_request_history | Debugging |
| 15 | get_scope_repetitions | Debugging |
| 16 | get_trigger_history | Triggers |
| 17 | get_trigger_callback_url | Triggers |
| 18 | run_trigger | Triggers |
| 19 | get_connections | Connections |
| 20 | get_connection_details | Connections |
| 21 | test_connection | Connections |
| 22 | create_connection | Connections |
| 23 | get_connector_swagger | Connectors |
| 24 | invoke_connector_operation | Connectors |
| 25 | create_workflow | Lifecycle |
| 26 | update_workflow | Lifecycle |
| 27 | delete_workflow | Lifecycle |
| 28 | enable_workflow | Lifecycle |
| 29 | disable_workflow | Lifecycle |
| 30 | cancel_run | Operations |
| 31 | get_host_status | Operations |
| 32 | list_workflow_versions | Versioning |
| 33 | get_workflow_version | Versioning |
| 34 | get_troubleshooting_guide | Knowledge |
| 35 | get_authoring_guide | Knowledge |
| 36 | get_reference | Knowledge |

---

# IMPLEMENTATION ROADMAP

## Phase 1: MCP Server Completion (Current)

| Task | Status | Notes |
|------|--------|-------|
| 33 Logic Apps tools | ✅ Done | Already implemented |
| Modular documentation | ✅ Done | 3,600 lines in docs/ |
| MCP Prompts | ✅ Done | 2 prompts registered |
| Knowledge tools (3) | 🔲 TODO | Add guide tools |
| npm package config | 🔲 TODO | package.json files array |
| Publish to npm | 🔲 TODO | @laveeshb/logicapps-mcp |
| Register on Smithery | 🔲 TODO | Discoverability |

## Phase 2: Logic Apps Agent Loop

| Task | Status | Notes |
|------|--------|-------|
| Design document | 🔲 TODO | This document |
| Condensed system prompt | 🔲 TODO | ~500 lines |
| Tool definitions (JSON) | 🔲 TODO | 36 tools |
| Workflow definition | 🔲 TODO | agent-loop.json |
| ARM/Bicep template | 🔲 TODO | Deployment package |
| Portal deployment guide | 🔲 TODO | For non-technical users |
| Testing | 🔲 TODO | End-to-end validation |

## Phase 3: Polish & Documentation

| Task | Status | Notes |
|------|--------|-------|
| README updates | 🔲 TODO | Both solutions |
| Video walkthrough | 🔲 TODO | Demo for users |
| Blog post | 🔲 TODO | Announcement |

---

# APPENDIX

## A. Azure Management API Reference

Base URL: `https://management.azure.com`

### List Logic Apps (Consumption)
```
GET /subscriptions/{subscriptionId}/providers/Microsoft.Logic/workflows?api-version=2019-05-01
```

### List Workflows (Standard)
```
GET /subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/Microsoft.Web/sites/{logicAppName}/hostruntime/runtime/webhooks/workflow/api/management/workflows?api-version=2022-03-01
```

### Get Run Actions
```
GET /subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/Microsoft.Logic/workflows/{workflowName}/runs/{runId}/actions?api-version=2019-05-01
```

## B. Token Estimation

| Component | Tokens (approx) |
|-----------|-----------------|
| System prompt (condensed) | 2,000 |
| Tool definitions (36 tools) | 3,000 |
| User message | 100-500 |
| Tool results (per call) | 500-2,000 |
| **Per request (typical)** | **8,000-15,000** |

At $0.01/1K input tokens (GPT-4o), typical request costs ~$0.10-0.15.

## C. Decision Log

| Decision | Rationale |
|----------|-----------|
| Two solutions, shared docs | Maximize reuse, maintain consistency |
| GitHub raw for agent docs | Simple, free, always current |
| Bundled docs for MCP | Reliability, works offline |
| 3 guide tools vs 1 | Tool names signal intent to LLM |
| Managed Identity for agent | Security best practice, no stored creds |
