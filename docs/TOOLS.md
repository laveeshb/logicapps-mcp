# Available Tools

This MCP server provides 37 tools for managing Azure Logic Apps.

## Discovery & Navigation

| Tool | Description |
|------|-------------|
| `list_subscriptions` | List all accessible Azure subscriptions |
| `list_logic_apps` | List Logic Apps in a subscription (filter by SKU) |
| `list_workflows` | List workflows within a Standard Logic App |

## Workflow Definitions

| Tool | Description |
|------|-------------|
| `get_workflow_definition` | Get workflow JSON definition |
| `get_workflow_swagger` | Get OpenAPI/Swagger definition for a workflow |
| `list_workflow_versions` | List all versions of a Consumption Logic App |
| `get_workflow_version` | Get a specific historical version's definition (Consumption only) |

## Triggers

| Tool | Description |
|------|-------------|
| `get_workflow_triggers` | Get trigger information and execution times |
| `get_trigger_history` | Get execution history of a specific trigger |
| `get_trigger_callback_url` | Get callback URL for request-based triggers |

## Run History & Debugging

| Tool | Description |
|------|-------------|
| `list_run_history` | Get run history with optional filtering |
| `search_runs` | Search runs with friendly parameters (status, time range, tracking ID) |
| `get_run_details` | Get details of a specific run |
| `get_run_actions` | Get action execution details for a run |
| `get_action_io` | Get actual input/output content for a run action |
| `get_action_repetitions` | Get iteration details for loop actions (ForEach, Until) |
| `get_scope_repetitions` | Get execution details for scope actions (Scope, Switch, Condition) |
| `get_action_request_history` | Get HTTP request/response details for connector actions |
| `get_expression_traces` | Get expression evaluation traces for an action |

## Connections & Connectors

| Tool | Description |
|------|-------------|
| `get_connections` | List API connections in a resource group |
| `get_connection_details` | Get detailed information about a specific API connection |
| `test_connection` | Test if an API connection is valid and healthy |
| `create_connection` | Create a new API connection for a managed connector |
| `get_connector_swagger` | Get OpenAPI/Swagger definition for a managed connector |
| `invoke_connector_operation` | Invoke dynamic operations to fetch schemas, tables, queues, etc. |

## Write Operations

| Tool | Description |
|------|-------------|
| `enable_workflow` | Enable a disabled workflow |
| `disable_workflow` | Disable an active workflow |
| `run_trigger` | Manually fire a workflow trigger |
| `cancel_run` | Cancel a running or waiting workflow run |
| `create_workflow` | Create a new workflow (Consumption: new Logic App; Standard: new workflow) |
| `update_workflow` | Update an existing workflow's definition |
| `delete_workflow` | Delete a workflow (use with caution) |

## Host & Diagnostics (Standard SKU)

| Tool | Description |
|------|-------------|
| `get_host_status` | Get host status for Standard Logic Apps (runtime version, diagnostics) |

## Knowledge Tools

| Tool | Description |
|------|-------------|
| `get_troubleshooting_guide` | Built-in documentation for debugging patterns |
| `get_authoring_guide` | Workflow authoring best practices |
| `get_reference_guide` | SKU differences and API reference |
| `get_workflow_instructions` | Common workflow patterns and examples |

## MCP Prompts

MCP Prompts provide AI assistants with guidance on tool selection and common workflows.

| Prompt | Description |
|--------|-------------|
| `logic-apps-guide` | System guidance covering SKU differences, debugging workflows, and tool selection tips |

> **Note**: Prompt availability depends on the MCP client. Claude Desktop supports prompts; GitHub Copilot does not yet.

## See Also

- [Getting Started](GETTING_STARTED.md) - Setup for local MCP server or cloud agent
- [Configuration](CONFIGURATION.md) - Environment variables, auth, SKU differences
- [Cloud Agent](CLOUD_AGENT.md) - Deploy to Azure for team/enterprise use
