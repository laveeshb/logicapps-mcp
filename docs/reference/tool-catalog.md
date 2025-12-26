# Tool Catalog

Complete reference for all 33 MCP tools available in `@laveeshb/logicapps-mcp`.

---

## Discovery Tools

### list_subscriptions

List all Azure subscriptions accessible to authenticated user.

**When:** User hasn't specified subscription, need to discover available subscriptions.

**Parameters:** None

**Example:**
```
list_subscriptions()
→ [{ id: "/subscriptions/xxx", displayName: "Production" }, ...]
```

---

### list_logic_apps

List Logic Apps in a subscription or resource group.

**When:** Finding Logic Apps, user doesn't remember exact names.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| subscriptionId | Yes | Azure subscription ID |
| resourceGroupName | No | Filter by resource group |
| sku | No | Filter: `consumption`, `standard`, or `all` |

**Example:**
```
list_logic_apps(subscriptionId, resourceGroupName='myRG', sku='standard')
→ [{ name: "my-logic-app", sku: "Standard", location: "westus2" }, ...]
```

---

### list_workflows

List workflows within a Standard Logic App.

**When:** Standard Logic Apps have multiple workflows; need to see what's inside.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| subscriptionId | Yes | Azure subscription ID |
| resourceGroupName | Yes | Resource group name |
| logicAppName | Yes | Logic App resource name |

**Example:**
```
list_workflows(subscriptionId, 'myRG', 'my-logic-app')
→ [{ name: "order-processor", state: "Enabled" }, { name: "notification-sender", state: "Enabled" }]
```

---

## Workflow Definition Tools

### get_workflow_definition

Get the full workflow definition JSON.

**When:** View workflow structure, prepare for modification.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| subscriptionId | Yes | Azure subscription ID |
| resourceGroupName | Yes | Resource group name |
| logicAppName | Yes | Logic App resource name |
| workflowName | Standard only | Workflow name within Standard Logic App |

**Example:**
```
get_workflow_definition(subscriptionId, 'myRG', 'my-logic-app', 'order-processor')
→ { definition: { triggers: {...}, actions: {...} } }
```

---

### create_workflow

Create a new workflow.

**When:** User wants to create a new workflow from scratch.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| subscriptionId | Yes | Azure subscription ID |
| resourceGroupName | Yes | Resource group name |
| logicAppName | Yes | For Consumption: new Logic App name. For Standard: existing Logic App |
| definition | Yes | Workflow definition JSON |
| workflowName | Standard only | Workflow name to create |
| location | Consumption only | Azure region |
| kind | Standard only | `Stateful` or `Stateless` |

**Example:**
```
create_workflow(subscriptionId, 'myRG', 'my-logic-app', definition, workflowName='new-workflow')
```

---

### update_workflow

Update an existing workflow's definition.

**When:** Modify workflow structure, add/remove actions.

**Parameters:** Same as create_workflow (replaces entire definition).

**Workflow:**
1. `get_workflow_definition` to get current
2. Modify JSON
3. `update_workflow` with new definition

---

### delete_workflow

Delete a workflow.

**When:** User explicitly requests deletion.

**⚠️ Destructive:** Consumption deletes entire Logic App. Standard deletes specific workflow.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| subscriptionId | Yes | Azure subscription ID |
| resourceGroupName | Yes | Resource group name |
| logicAppName | Yes | Logic App resource name |
| workflowName | Standard only | Workflow to delete |

---

### enable_workflow / disable_workflow

Enable or disable a workflow.

**When:** Maintenance, stop processing temporarily.

**Note for Standard:** Uses app settings (`Workflows.<name>.FlowState`), not direct API.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| subscriptionId | Yes | Azure subscription ID |
| resourceGroupName | Yes | Resource group name |
| logicAppName | Yes | Logic App resource name |
| workflowName | Standard only | Workflow name |

---

### get_workflow_swagger

Get OpenAPI/Swagger definition for a workflow.

**When:** Generate API documentation, create client SDK.

---

### list_workflow_versions

List historical versions of a Consumption workflow.

**When:** Need to rollback, see change history.

**Consumption only.**

---

### get_workflow_version

Get a specific historical version's definition.

**When:** Compare versions, rollback to previous.

**Consumption only.**

---

## Trigger Tools

### get_workflow_triggers

Get trigger info including last/next fire times.

**When:** Check trigger configuration, verify it's set up correctly.

**Returns:**
- Trigger name, type
- Last fire time
- Next fire time (for recurrence)
- State

---

### get_trigger_history

Get execution history for a trigger.

**When:** Trigger not firing as expected, need to see if it's checking.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| subscriptionId, resourceGroupName, logicAppName | Yes | Resource identifiers |
| triggerName | Yes | Trigger name |
| workflowName | Standard only | Workflow name |
| filter | No | OData filter (e.g., `"status eq 'Failed'"`) |
| top | No | Number of entries (default 25, max 100) |

---

### get_trigger_callback_url

Get the HTTP trigger URL with SAS token.

**When:** User needs the URL to call the workflow.

---

### run_trigger

Manually fire a trigger.

**When:** Test workflow, force immediate execution.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| subscriptionId, resourceGroupName, logicAppName | Yes | Resource identifiers |
| triggerName | Yes | Trigger name (e.g., `manual`, `Recurrence`) |
| workflowName | Standard only | Workflow name |

---

## Run History Tools

### list_run_history

Get run history with optional OData filter.

**When:** Browse recent runs, need raw OData filtering.

---

### search_runs

Search runs with friendly parameters.

**When:** Filter by status, time range, tracking ID.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| subscriptionId, resourceGroupName, logicAppName | Yes | Resource identifiers |
| workflowName | Standard only | Workflow name |
| status | No | `Succeeded`, `Failed`, `Cancelled`, `Running` |
| startTime | No | ISO timestamp (runs after this time) |
| endTime | No | ISO timestamp (runs before this time) |
| clientTrackingId | No | Correlation/tracking ID |
| top | No | Number of results (default 25) |

**Example:**
```
search_runs(subscriptionId, 'myRG', 'my-logic-app', status='Failed', startTime='2025-01-01T00:00:00Z')
```

---

### get_run_details

Get detailed info about a specific run.

**When:** See overall run status, error summary.

**Returns:**
- Status, start/end times
- Error summary if failed
- Trigger info

---

### get_run_actions

Get action execution details for a run.

**When:** Find which action failed, see execution order.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| subscriptionId, resourceGroupName, logicAppName, runId | Yes | Resource identifiers |
| workflowName | Standard only | Workflow name |
| actionName | No | Filter to specific action |

**Returns per action:**
- Status, timing
- Tracked properties
- Error info

---

### get_action_io

Get actual inputs and outputs for an action.

**When:** See what data was passed, debug data issues.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| ...standard params... | Yes | |
| actionName | Yes | Action name |
| type | No | `inputs`, `outputs`, or `both` (default) |

---

### get_expression_traces

Get expression evaluation traces.

**When:** Debug expression errors, see how @body(), @variables() evaluated.

**Returns:**
- Expression text
- Evaluated result
- Error if failed

---

### get_action_repetitions

Get loop iteration details.

**When:** Debug ForEach/Until failures, see per-iteration results.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| ...standard params... | Yes | |
| actionName | Yes | Loop action name |
| repetitionName | No | Specific iteration (e.g., `000000`) |

---

### get_scope_repetitions

Get scope/condition execution details.

**When:** See which branch of Condition/Switch executed.

---

### get_action_request_history

Get HTTP request/response details with retries.

**When:** Debug HTTP/connector action failures, see actual requests.

---

### cancel_run

Cancel a running or waiting execution.

**When:** Stop stuck workflow, abort long-running process.

**Only works on:** `Running` or `Waiting` status.

---

## Connection Tools

### get_connections

List API connections in a resource group.

**When:** See what connections exist, find connection names.

---

### get_connection_details

Get detailed info about a connection.

**When:** Check auth type, status, configuration.

---

### test_connection

Verify a connection is working.

**When:** Debug connector failures, check if connection is healthy.

**Returns:** Status, error details if failed.

---

### create_connection

Create a new API connection.

**When:** Setting up new connector integration.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| subscriptionId, resourceGroupName | Yes | Resource identifiers |
| connectionName | Yes | Name for new connection |
| connectorName | Yes | Connector type (e.g., `sql`, `office365`) |
| location | Yes | Azure region |
| parameterValues | For non-OAuth | Connection parameters |
| displayName | No | Friendly name |

**OAuth connectors:** Returns consent link. User must authorize in browser.

---

### get_connector_swagger

Get OpenAPI definition for a managed connector.

**When:** Discover connector operations, build actions.

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| subscriptionId | Yes | Azure subscription ID |
| location | Yes | Azure region |
| connectorName | Yes | Connector name (e.g., `sql`, `servicebus`, `office365`) |

**Returns:** Operations, paths, schemas, parameters.

---

### invoke_connector_operation

Call a dynamic operation on a connection.

**When:** Get dropdown values (tables, queues, folders).

**Parameters:**
| Name | Required | Description |
|------|----------|-------------|
| subscriptionId, resourceGroupName | Yes | Resource identifiers |
| connectionName | Yes | Existing connection name |
| operationId | Yes | Operation from swagger (e.g., `GetTables`) |
| parameters | No | Operation parameters |

**Example:**
```
invoke_connector_operation(sub, rg, 'sql-1', 'GetTables')
→ [{ "Name": "dbo.Orders" }, { "Name": "dbo.Customers" }]
```

---

## Host Tools

### get_host_status

Get Standard Logic App host status.

**When:** Check runtime version, extension bundle, diagnostics.

**Standard only.**

---

## Tool Selection Guide

| I want to... | Use |
|--------------|-----|
| Find Logic Apps | `list_logic_apps` |
| See workflow definition | `get_workflow_definition` |
| Create a workflow | `create_workflow` |
| Find failed runs | `search_runs` + `get_run_details` |
| Debug failed action | `get_run_actions` + `get_action_io` |
| Debug expression | `get_expression_traces` |
| Debug loop | `get_action_repetitions` |
| Check connection health | `test_connection` |
| Find connector operations | `get_connector_swagger` |
| Get table/queue list | `invoke_connector_operation` |
| Stop stuck run | `cancel_run` |
| Test workflow | `run_trigger` |
