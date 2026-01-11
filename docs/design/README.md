---
version: 0.3.0
lastUpdated: 2025-12-30
---

# Logic Apps MCP Server - Design Overview

## Executive Summary

This document describes the design for a Logic Apps MCP Server that enables AI assistants to interact with Azure Logic Apps through natural language. The solution is offered in **two deployment models** to serve different use cases.

---

## Deployment Models

| Model | Use Case | LLM | Auth |
|-------|----------|-----|------|
| **Local MCP Server** | Individual developers with local AI tools | User's subscription (Copilot, Claude, etc.) | Azure CLI (`az login`) |
| **Cloud MCP Server** | Remote/hosted AI integrations | Bring your own AI client | Passthrough (client provides bearer token) |

---

## Architecture Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SHARED COMPONENTS                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - 40 Tools (36 Logic Apps operations + 4 knowledge tools)          │   │
│  │  - Bundled documentation (~3,600 lines)                             │   │
│  │  - Same TypeScript codebase                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                   │
                    ▼                                   ▼
┌───────────────────────────────────┐   ┌───────────────────────────────────┐
│  LOCAL MCP SERVER                 │   │  CLOUD MCP SERVER                 │
│  (Individual developers)          │   │  (Remote AI integrations)         │
├───────────────────────────────────┤   ├───────────────────────────────────┤
│  Runtime: User's machine          │   │  Runtime: Azure Function App      │
│  Transport: stdio                 │   │  Transport: HTTP                  │
│  LLM: Claude/GPT/etc (theirs)     │   │  LLM: Bring your own             │
│  Auth: Azure CLI credentials      │   │  Auth: Passthrough (bearer token) │
│  Frontend: Claude/Copilot/Cursor  │   │  Frontend: Any MCP client        │
└───────────────────────────────────┘   └───────────────────────────────────┘
```

---

## Solution Details

### [Local MCP Server](LOCAL_MCP_SERVER.md)

- npm package: `logicapps-mcp`
- Works with: VS Code Copilot, Claude Desktop, Cursor, Windsurf
- Distribution: npm, mcp.so, Smithery
- Auth: Uses Azure CLI cached credentials (`az login`)
- **Status**: ✅ Implemented

### [Cloud MCP Server](CLOUD_MCP_SERVER.md)

- Deployment: Azure Function App via Bicep
- Transport: HTTP (MCP over HTTP)
- Auth: Passthrough - clients provide ARM-scoped bearer token
- No managed identity for ARM access - all access is through client tokens
- **Status**: ✅ Implemented

---

## Shared Tool Catalog

Both solutions implement the same 40 tools:

### Logic Apps Operations (36 tools)

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

## Implementation Status

### Local MCP Server ✅

| Task | Status |
|------|--------|
| 33 Logic Apps tools | ✅ Done |
| 3 Knowledge tools | ✅ Done |
| Bundled documentation | ✅ Done |
| npm package config | ✅ Done |
| Tests passing | ✅ Done |

### Cloud MCP Server ✅

| Task | Status |
|------|--------|
| HTTP transport for MCP server | ✅ Done |
| Azure Functions wrapper | ✅ Done |
| Passthrough auth | ✅ Done |
| Bicep deployment template | ✅ Done |
| Deploy scripts (PS1 + Bash) | ✅ Done |
| Documentation | ✅ Done |

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Two solutions, shared code | Maximize reuse, maintain consistency |
| Bundled docs for MCP | Reliability, works offline |
| Function App for cloud MCP | Reuse same TypeScript code |
| Passthrough auth for cloud | No server-side credentials needed, user-scoped access |
| No managed identity for ARM | Simpler, users see only what they can access |

---

## References

- [Local MCP Server - Detailed Design](LOCAL_MCP_SERVER.md)
- [Cloud MCP Server - Detailed Design](CLOUD_MCP_SERVER.md)
