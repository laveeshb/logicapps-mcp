# Logic Apps MCP Server - Usage Guide

A guide for using the Logic Apps MCP tools to author, debug, and manage Azure Logic Apps workflows.

## What This Enables

With these MCP tools, you can:
- **Author** workflows from natural language descriptions
- **Debug** run failures with root cause analysis  
- **Manage** workflow lifecycle (enable, disable, test, deploy)

Works with both **Consumption** and **Standard** SKUs.

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure RBAC: `Logic App Contributor` (or `Reader` for debugging only)
- MCP server `@laveeshb/logicapps-mcp` configured

---

## Quick Reference

### Debugging a Failed Run

```
1. search_runs(status='Failed')           → Find failed runs
2. get_run_details(runId)                 → Error summary
3. get_run_actions(runId)                 → Find failed action
4. get_action_io(runId, actionName)       → See actual data
5. Explain root cause → Suggest fix
```

### Creating a Workflow

```
1. Identify triggers/actions from description
2. get_connector_swagger(connectorName)   → Discover operations
3. invoke_connector_operation(...)        → Get schemas (tables, queues)
4. Build definition JSON
5. create_workflow(definition)
6. run_trigger() to test
```

### Key Tools by Task

| Task | Tools |
|------|-------|
| Find Logic Apps | `list_subscriptions`, `list_logic_apps`, `list_workflows` |
| Read/Write workflows | `get_workflow_definition`, `create_workflow`, `update_workflow` |
| Debug failures | `search_runs`, `get_run_details`, `get_run_actions`, `get_action_io` |
| Debug expressions | `get_expression_traces` |
| Debug loops | `get_action_repetitions` |
| Check connections | `get_connections`, `test_connection` |
| Discover connectors | `get_connector_swagger`, `invoke_connector_operation` |
| Control workflows | `enable_workflow`, `disable_workflow`, `run_trigger`, `cancel_run` |
| Get guidance | `get_authoring_guide`, `get_troubleshooting_guide`, `get_reference` |

---

## Detailed Documentation

### Troubleshooting
- [Troubleshooting Index](troubleshooting/README.md) - Quick diagnosis guide
- [Expression Errors](troubleshooting/expression-errors.md) - Null checks, type conversions
- [Connection Issues](troubleshooting/connection-issues.md) - OAuth, managed identity
- [Run Failures](troubleshooting/run-failures.md) - Failed actions, triggers, loops
- [Known Limitations](troubleshooting/known-limitations.md) - Platform constraints

### Authoring
- [Authoring Guide](authoring/README.md) - Workflow creation overview
- [Workflow Patterns](authoring/workflow-patterns.md) - Triggers, control flow, error handling
- [Connector Patterns](authoring/connector-patterns.md) - SQL, Service Bus, Blob, Office 365
- [Deployment Guide](authoring/deployment.md) - ARM, Terraform, CI/CD

### Reference
- [Tool Catalog](reference/tool-catalog.md) - All 37 tools with examples
- [SKU Differences](reference/sku-differences.md) - Consumption vs Standard
- [Quick Reference](reference/quick-reference.md) - Security, monitoring, testing, pricing, limits

### Microsoft Docs (External)

| Topic | Link |
|-------|------|
| Workflow definition language | [Docs](https://learn.microsoft.com/azure/logic-apps/logic-apps-workflow-definition-language) |
| Expression functions | [Docs](https://learn.microsoft.com/azure/logic-apps/workflow-definition-language-functions-reference) |
| Triggers and actions | [Docs](https://learn.microsoft.com/azure/logic-apps/logic-apps-workflow-actions-triggers) |
| Error handling | [Docs](https://learn.microsoft.com/azure/logic-apps/logic-apps-exception-handling) |
| Limits and configuration | [Docs](https://learn.microsoft.com/azure/logic-apps/logic-apps-limits-and-config) |
| Secure access and data | [Docs](https://learn.microsoft.com/azure/logic-apps/logic-apps-securing-a-logic-app) |
| Monitor workflows | [Docs](https://learn.microsoft.com/azure/logic-apps/monitor-logic-apps) |
| Diagnose failures | [Docs](https://learn.microsoft.com/azure/logic-apps/logic-apps-diagnosing-failures) |
| VNet integration (Standard) | [Docs](https://learn.microsoft.com/azure/logic-apps/secure-single-tenant-workflow-virtual-network-private-endpoint) |
| Agent workflows (Preview) | [Docs](https://learn.microsoft.com/azure/logic-apps/agent-workflows-concepts) |

---

## Common Errors Quick Reference

| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Token expired | Re-authorize connection → [Connection issues](troubleshooting/connection-issues.md) |
| "The browser is closed" | OAuth popup closed | Re-auth in portal → [OAuth errors](troubleshooting/connection-issues.md#oauth-errors) |
| InvalidTemplate | Expression syntax error | Check expression syntax → [Expression errors](troubleshooting/expression-errors.md) |
| ActionFailed | Upstream action failed | Check runAfter dependencies → [Run failures](troubleshooting/run-failures.md) |
| Integration account required | JavaScript action | Attach integration account → [Limitations](troubleshooting/known-limitations.md) |
| Null reference | Missing property | Use `?` operator → [Null handling](troubleshooting/expression-errors.md#null-reference-errors) |
| Cannot reach host runtime | Storage account issue (Standard) | Check app settings → [Storage issues](troubleshooting/known-limitations.md#storage-account-issues) |
| CPU high (Standard) | Scale or optimize workflows | Configure auto-scale → [Scaling](reference/sku-differences.md#scaling-standard-only) |

---

## Critical SKU Knowledge

### Standard Gotchas

1. **Enable/Disable** uses app settings (`Workflows.<name>.FlowState`), not direct API
2. **V2 Connections** require `connectionRuntimeUrl` and portal authorization for OAuth
3. **Workflow files** are stored in VFS, not ARM properties
4. **Always provide `workflowName`** parameter for Standard Logic Apps

### Consumption Gotchas

1. **One trigger per workflow** - use multiple workflows for multiple triggers
2. **JavaScript needs Integration Account** - costs ~$300/month
3. **Can't rename** - must create new, copy definition, delete old

See [SKU Differences](reference/sku-differences.md) for full details.

---

## Best Practices to Suggest

- Wrap critical actions in Scope for try-catch error handling
- Set retry policies on HTTP actions
- Use Managed Identity instead of connection strings
- Always set limits on Until loops
- Test in non-production before deploying

---

## Finding More Information

This documentation is in a modular structure. When you need detailed patterns:

**Read files from these paths (relative to this file):**
- `troubleshooting/expression-errors.md` - Null checks, type conversions, date handling
- `troubleshooting/connection-issues.md` - OAuth, Managed Identity, connector auth
- `troubleshooting/run-failures.md` - Failed actions, triggers, loops, timeouts
- `troubleshooting/known-limitations.md` - Platform constraints and workarounds
- `authoring/workflow-patterns.md` - Triggers, control flow, error handling patterns
- `authoring/connector-patterns.md` - SQL, Service Bus, Blob, Office 365 examples
- `authoring/deployment.md` - ARM templates, Terraform, CI/CD
- `reference/tool-catalog.md` - All 36 MCP tools with examples
- `reference/sku-differences.md` - Consumption vs Standard deep dive

**When uncertain:**
1. Use `get_connector_swagger` to discover connector operations
2. Fetch Azure docs from URLs in this file (with user consent)
3. Read the relevant doc file above for patterns
4. Ask user for clarification rather than guessing
