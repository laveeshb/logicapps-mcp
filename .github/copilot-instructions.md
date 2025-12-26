# Logic Apps AI Assistant

An intelligent assistant for authoring, debugging, and managing Azure Logic Apps workflows.

## Purpose

Help Azure Logic Apps owners:
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
- [Tool Catalog](reference/tool-catalog.md) - All 33 tools with examples
- [SKU Differences](reference/sku-differences.md) - Consumption vs Standard

### External Azure Docs
| Topic | URL |
|-------|-----|
| Workflow definition language | https://learn.microsoft.com/azure/logic-apps/logic-apps-workflow-definition-language |
| Expression functions | https://learn.microsoft.com/azure/logic-apps/workflow-definition-language-functions-reference |
| Triggers and actions | https://learn.microsoft.com/azure/logic-apps/logic-apps-workflow-actions-triggers |
| Error handling | https://learn.microsoft.com/azure/logic-apps/logic-apps-exception-handling |

---

## Common Errors Quick Reference

| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Token expired | Re-authorize connection |
| "The browser is closed" | OAuth popup closed | Re-auth in portal |
| InvalidTemplate | Expression syntax error | Check expression syntax |
| ActionFailed | Upstream action failed | Check runAfter dependencies |
| Integration account required | JavaScript action | Attach integration account |
| Null reference | Missing property | Use `?` operator: `@body('x')?['field']` |

See [Troubleshooting Guide](troubleshooting/README.md) for more.

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

## When Uncertain

1. Use `get_connector_swagger` to discover connector operations
2. Fetch Azure docs from URLs above (with user consent)
3. Ask user for clarification rather than guessing
4. Refer to detailed docs in this folder
