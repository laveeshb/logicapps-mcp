---
version: 0.3.0
lastUpdated: 2025-12-26
---

# Logic Apps AI Assistant - Design Overview

## Executive Summary

This document describes the design for a Logic Apps AI Assistant that helps users debug, author, and manage Azure Logic Apps through natural language. The solution is offered in **two deployment models** to serve different customer segments.

---

## Customer Segments

| Segment | Profile | LLM | Solution | Cost |
|---------|---------|-----|----------|------|
| **Enterprise with AI** | Has GitHub Copilot, Claude, Cursor | User's subscription | [Local MCP Server](LOCAL_MCP_SERVER.md) | Free |
| **No AI Subscription** | Azure subscription only | Azure AI Foundry | [Cloud Agent Loop](CLOUD_AGENT_LOOP.md) | Pay-per-use |

---

## Architecture Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SHARED COMPONENTS                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • 36 Tools (33 Logic Apps operations + 3 knowledge tools)          │   │
│  │  • Bundled documentation (~3,600 lines)                             │   │
│  │  • Same TypeScript codebase                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                   │
                    ▼                                   ▼
┌───────────────────────────────────┐   ┌───────────────────────────────────┐
│  LOCAL MCP SERVER                 │   │  CLOUD AGENT LOOP                 │
│  (Enterprise with AI tools)       │   │  (No AI subscription)             │
├───────────────────────────────────┤   ├───────────────────────────────────┤
│  Runtime: User's machine          │   │  Runtime: Azure (LA + FA)         │
│  Transport: stdio                 │   │  Transport: HTTP SSE              │
│  LLM: Claude/GPT/etc (theirs)     │   │  LLM: Azure AI Foundry            │
│  Auth: Azure CLI (az login)       │   │  Auth: Managed Identity           │
│  Frontend: Claude/Copilot/Cursor  │   │  Frontend: Built-in Chat UI       │
│  Cost: Free                       │   │  Cost: ~$325/mo + tokens          │
└───────────────────────────────────┘   └───────────────────────────────────┘
```

---

## Solution Details

### [Local MCP Server](LOCAL_MCP_SERVER.md)

- npm package: `@laveeshb/logicapps-mcp`
- Works with: VS Code Copilot, Claude Desktop, Cursor, Windsurf
- Distribution: npm, mcp.so, Smithery
- **Status**: ✅ Implemented

### [Cloud Agent Loop](CLOUD_AGENT_LOOP.md)

- Logic Apps Standard + Function App
- Uses "Bring Your Own MCP" feature
- Managed Identity authentication
- **Status**: 🔲 Phase 2

---

## Shared Tool Catalog

Both solutions implement the same 36 tools:

### Logic Apps Operations (33 tools)

| Category | Tools |
|----------|-------|
| **Discovery** | list_subscriptions, list_logic_apps, list_workflows |
| **Inspection** | get_workflow_definition, get_workflow_triggers, get_workflow_swagger |
| **Run History** | list_run_history, search_runs, get_run_details, get_run_actions |
| **Debugging** | get_action_io, get_action_repetitions, get_expression_traces, get_action_request_history, get_scope_repetitions |
| **Triggers** | get_trigger_history, get_trigger_callback_url, run_trigger |
| **Connections** | get_connections, get_connection_details, test_connection, create_connection |
| **Connectors** | get_connector_swagger, invoke_connector_operation |
| **Lifecycle** | create_workflow, update_workflow, delete_workflow, enable_workflow, disable_workflow |
| **Operations** | cancel_run, get_host_status |
| **Versioning** | list_workflow_versions, get_workflow_version |

### Knowledge Tools (3 tools)

| Tool | Topics |
|------|--------|
| get_troubleshooting_guide | expression-errors, connection-issues, run-failures, known-limitations |
| get_authoring_guide | workflow-patterns, connector-patterns, deployment |
| get_reference | tool-catalog, sku-differences |

---

## Shared Documentation

Both solutions consume the same bundled documentation:

```
docs/
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

**Size**: ~3,600 lines (~15-20KB)

---

## Implementation Status

### Phase 1: Local MCP Server ✅

| Task | Status |
|------|--------|
| 33 Logic Apps tools | ✅ Done |
| 3 Knowledge tools | ✅ Done |
| Bundled documentation | ✅ Done |
| npm package config | ✅ Done |
| Tests passing | ✅ Done |

### Phase 2: Cloud Agent Loop 🔲

| Task | Status |
|------|--------|
| HTTP transport for MCP server | 🔲 TODO |
| Azure Functions wrapper | 🔲 TODO |
| Agent Loop workflow | 🔲 TODO |
| Bicep deployment template | 🔲 TODO |
| Documentation | 🔲 TODO |

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Two solutions, shared code | Maximize reuse, maintain consistency |
| Bundled docs for MCP | Reliability, works offline |
| Function App for cloud MCP | Reuse same TypeScript code |
| Managed Identity | Security best practice, no secrets |
| Easy Auth on both apps | Zero-trust, identity-based access |
| "Bring Your Own MCP" | Native Agent Loop integration |

---

## References

- [Local MCP Server - Detailed Design](LOCAL_MCP_SERVER.md)
- [Cloud Agent Loop - Detailed Design](CLOUD_AGENT_LOOP.md)
- [MCP Server Support for Agent Loop](https://techcommunity.microsoft.com/blog/integrationsonazureblog/announcing-mcp-server-support-for-logic-apps-agent-loop/4470778)
