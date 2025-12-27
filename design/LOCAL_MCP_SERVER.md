---
version: 0.3.0
lastUpdated: 2025-12-26
---

# Logic Apps MCP Server - Local Solution

## Overview

An npm package that implements the Model Context Protocol (MCP), enabling any MCP-compatible AI assistant to interact with Azure Logic Apps through natural language.

## Target Users

| Profile | Details |
|---------|---------|
| **Organizations** | Enterprise with GitHub Copilot, Claude, Cursor, or similar AI tools |
| **LLM** | Already paid for via existing subscriptions |
| **Cost** | None (uses their existing AI subscription) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  User's Machine                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐    stdio    ┌────────────────────────────────────┐│
│  │  AI Client          │◄───────────►│  MCP Server                        ││
│  │  (Claude/Copilot/   │             │  @laveeshb/logicapps-mcp           ││
│  │   Cursor/Windsurf)  │             │                                    ││
│  │                     │             │  ├── 33 Logic Apps tools           ││
│  │  User's LLM         │             │  ├── 3 Knowledge tools             ││
│  │  subscription       │             │  └── Bundled docs (~3,600 lines)   ││
│  └─────────────────────┘             └────────────────────────────────────┘│
│                                                   │                         │
│                                                   │ Azure CLI credentials   │
│                                                   ▼                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  ~/.azure/  (cached credentials from `az login`)                       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ HTTPS (Bearer token)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Azure Resource Manager (management.azure.com)                              │
│  └── Logic Apps REST APIs                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Distribution

| Channel | Purpose |
|---------|---------|
| **npm** | `@laveeshb/logicapps-mcp` - Primary distribution |
| **mcp.so** | Discoverability for Claude/MCP users |
| **Smithery.ai** | MCP registry |
| **GitHub** | Source code, issues, documentation |

---

## Installation

```bash
# Via npx (recommended - always latest)
npx -y @laveeshb/logicapps-mcp

# Via npm global install
npm install -g @laveeshb/logicapps-mcp
logicapps-mcp
```

---

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
// Windows: %APPDATA%\Claude\claude_desktop_config.json
// macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
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

---

## Tool Architecture

### Layer 1: Logic Apps Operations (33 tools)

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

| Tool | Topics | Purpose |
|------|--------|---------|
| `get_troubleshooting_guide` | expression-errors, connection-issues, run-failures, known-limitations | Debugging guidance |
| `get_authoring_guide` | workflow-patterns, connector-patterns, deployment | Building workflows |
| `get_reference` | tool-catalog, sku-differences | Reference documentation |

### Implementation

Knowledge tools read from bundled docs for offline reliability:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

export function getTroubleshootingGuide(topic: string): string {
  const docsPath = join(__dirname, '../../docs');
  const filePath = join(docsPath, 'troubleshooting', `${topic}.md`);
  return readFileSync(filePath, 'utf-8');
}
```

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User runs: az login                                     │
│     └── Creates ~/.azure/mcp_token_cache.json               │
├─────────────────────────────────────────────────────────────┤
│  2. MCP Server starts                                       │
│     └── @azure/identity DefaultAzureCredential              │
│         └── Reads cached credentials                        │
├─────────────────────────────────────────────────────────────┤
│  3. Tool called (e.g., list_logic_apps)                     │
│     └── Gets access token for ARM                           │
│     └── Calls Azure Management API                          │
│     └── Returns result to AI                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Package Structure

```
@laveeshb/logicapps-mcp/
├── package.json
├── README.md
├── dist/                    # Compiled TypeScript
│   ├── index.js
│   ├── server.js
│   └── tools/
│       ├── handler.js
│       ├── definitions.js
│       └── knowledge.js
└── docs/                    # Bundled documentation
    ├── troubleshooting/
    │   ├── expression-errors.md
    │   ├── connection-issues.md
    │   ├── run-failures.md
    │   └── known-limitations.md
    ├── authoring/
    │   ├── workflow-patterns.md
    │   ├── connector-patterns.md
    │   └── deployment.md
    └── reference/
        ├── tool-catalog.md
        └── sku-differences.md
```

---

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

## Supported AI Clients

| Client | Platform | Status |
|--------|----------|--------|
| **GitHub Copilot** | VS Code | ✅ Supported |
| **Claude Desktop** | Windows/macOS | ✅ Supported |
| **Claude Code** | CLI | ✅ Supported |
| **Cursor** | IDE | ✅ Supported |
| **Windsurf** | IDE | ✅ Supported |
| **Cline** | VS Code Extension | ✅ Supported |
| **Continue** | IDE Extension | ✅ Supported |

---

## Version History

| Version | Changes |
|---------|---------|
| 0.3.0 | Added 3 knowledge tools, bundled docs |
| 0.2.0 | Initial release with 33 Logic Apps tools |
