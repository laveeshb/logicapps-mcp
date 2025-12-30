# Azure Logic Apps MCP Server

<img src="https://raw.githubusercontent.com/benc-uk/icon-collection/master/azure-icons/Logic-Apps.svg" alt="Azure Logic Apps" width="80" align="right">

Manage and debug Azure Logic Apps using natural language. Ask your AI assistant to investigate failed runs, explain workflows, or make changes—no portal clicking required.

```
You:  Why did my order-processing workflow fail this morning?

AI:   Looking at the run history... Found a failed run at 10:15 AM.
      The HTTP action "Call-Payment-API" failed with 503 Service Unavailable.
      The payment service at api.payments.com was down for 3 minutes.

You:  Add retry logic to that action - 3 attempts with exponential backoff.

AI:   Done. Updated the workflow with retry policy. Want me to test it?
```

Works with **GitHub Copilot**, **Claude Desktop**, or as a **cloud-hosted agent**. Supports both Consumption and Standard Logic Apps.

## Table of Contents

- [Choose Your Setup](#choose-your-setup)
- [Quick Start](#quick-start)
- [Features](#features)
- [SKU Differences](#sku-differences)
- [AI-Powered Logic Apps Development](#ai-powered-logic-apps-development)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage with Claude Desktop](#usage-with-claude-desktop)
- [Usage with GitHub Copilot in VS Code](#usage-with-github-copilot-in-vs-code)
- [Cloud Agent](#cloud-agent)
- [Authentication](#authentication)
- [Available Tools](#available-tools)
- [Available Prompts](#available-prompts)
- [Example Prompts](#example-prompts)
- [Development](#development)
- [Architecture](#architecture)

## Choose Your Setup

This project offers two ways to use AI with Azure Logic Apps:

| | Local MCP Server | Cloud Agent |
|--|------------------|-------------|
| **Use when** | You have a local AI (Copilot, Claude) and can `az login` to access the Logic Apps | You need shared/audited access, or can't access Logic Apps directly |
| **Setup** | `npm install` + AI config | Deploy to Azure (Bicep) |
| **Auth** | Your Azure CLI credentials | Managed Identity |

**Not sure which to choose?** See the [Getting Started Guide](docs/GETTING_STARTED.md) for a decision flowchart and detailed comparison.

## Quick Start

### Prerequisites

- [Azure CLI](https://aka.ms/installazurecli) installed and authenticated (`az login`)
- Node.js 20+

### Install

```bash
# 1. Install globally
npm install -g github:laveeshb/logicapps-mcp

# 2. Login to Azure CLI
az login

# 3. Add to your AI assistant (see sections below) and restart
```

## Features

- **Dual SKU Support**: Works with both Consumption (`Microsoft.Logic/workflows`) and Standard (`Microsoft.Web/sites`) Logic Apps
- **37 Tools**: 33 Logic Apps operations + 4 knowledge tools for troubleshooting, authoring, reference, and workflow instructions
- **Write Operations**: Create, update, delete, enable/disable workflows; run triggers; cancel runs
- **Connector Support**: Discover connectors, invoke dynamic operations, create connections
- **Knowledge Tools**: Built-in documentation for debugging patterns, workflow authoring, and SKU differences
- **Multi-Cloud**: Supports Azure Public, Government, and China clouds
- **Secure Authentication**: Uses Azure CLI tokens with automatic refresh
- **No Azure SDK**: Pure REST API implementation with minimal dependencies

## SKU Differences

Logic Apps come in two SKUs with different architectures. This MCP server handles both transparently, but there are some important differences:

| Aspect | Consumption | Standard |
|--------|-------------|----------|
| Resource Type | `Microsoft.Logic/workflows` | `Microsoft.Web/sites` + workflows |
| Workflows per Resource | 1 (Logic App = Workflow) | Multiple workflows per Logic App |
| Enable/Disable | Direct API call | Uses app settings (`Workflows.<name>.FlowState`) |
| Connections | V1 API connections | V2 API connections with `connectionRuntimeUrl` |
| Create/Update | ARM API | VFS API (file-based) |

### API Connections for Standard Logic Apps

Standard Logic Apps use **V2 API connections** which require additional setup:

1. **Create V2 connection** with `kind: "V2"` property
2. **Authorize via Azure Portal** (OAuth connectors require browser-based consent)
3. **Create access policy** to grant the Logic App's managed identity access to the connection
4. **Update connections.json** in the Logic App with the `connectionRuntimeUrl`

> **Note**: The `create_connection` tool creates the connection resource, but for Standard Logic Apps with OAuth connectors (Office 365, SharePoint, etc.), you'll need to authorize the connection in the Azure Portal and manually configure the access policy and `connections.json`. This multi-step process is better suited for a custom agent workflow rather than individual MCP tool calls.

## AI-Powered Logic Apps Development

This MCP server enables you to develop, test, and manage Logic Apps entirely through conversation with an AI assistant—no portal or VS Code extension required.

### Development Workflow

**Create a new workflow from a description:**
> "Create a Logic App workflow that triggers on HTTP request, calls a REST API, and sends the response to a Service Bus queue"

The AI can generate the workflow definition JSON and deploy it directly using `create_workflow`.

**Iterate on designs:**
> "Get the current workflow definition, add error handling with a try-catch scope, and update it"

The AI retrieves the definition with `get_workflow_definition`, modifies it, and deploys with `update_workflow`.

### Testing & Debugging

**Run and verify:**
> "Run the HTTP trigger on my-workflow and show me the results"

The AI uses `run_trigger`, then `list_run_history` and `get_run_actions` to report outcomes.

**Debug failures:**
> "The last run failed. What went wrong?"

The AI chains `list_run_history` → `get_run_details` → `get_run_actions` → `get_action_io` to trace the failure and show exact inputs/outputs.

**Investigate loops:**
> "Show me which iterations failed in the ForEach loop"

Uses `get_action_repetitions` to analyze each iteration's status and data.

### Operations & Management

**Enable/disable for maintenance:**
> "Disable the order-processing workflow while we update the backend API"

**Cancel runaway executions:**
> "There's a stuck workflow run. Cancel it."

**Monitor health:**
> "Show me all failed runs from the last 24 hours across my Logic Apps"

### Typical Session

```
You: List my Logic Apps in the production resource group
AI:  [Uses list_logic_apps] Found 3 Logic Apps: order-processor, notification-sender, data-sync

You: Show me failed runs for order-processor today
AI:  [Uses search_runs] Found 2 failed runs at 10:15 AM and 2:30 PM

You: What failed in the 10:15 run?
AI:  [Uses get_run_actions, get_action_io] The HTTP action failed with 503 Service Unavailable. 
     The backend API at api.example.com was down.

You: Add retry logic to that HTTP action - 3 retries with exponential backoff
AI:  [Uses get_workflow_definition, update_workflow] Done. Added retry policy with 3 attempts.

You: Run it again to test
AI:  [Uses run_trigger, list_run_history] Success! The workflow completed in 2.3 seconds.
```

### Benefits Over Portal/Extension

| Capability | Portal | VS Code Extension | AI + MCP |
|------------|--------|-------------------|----------|
| Natural language interface | ❌ | ❌ | ✅ |
| Automated debugging | ❌ | ❌ | ✅ |
| Batch operations | ❌ | Limited | ✅ |
| Context-aware suggestions | ❌ | Limited | ✅ |
| Works in any environment | ❌ | VS Code only | ✅ |

## Installation

### Via npm (from GitHub)

```bash
npm install -g github:laveeshb/logicapps-mcp
```

Or use directly with npx:

```bash
npx github:laveeshb/logicapps-mcp
```

### From Source

```bash
git clone https://github.com/laveeshb/logicapps-mcp.git
cd logicapps-mcp
npm install
npm run build
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AZURE_TENANT_ID` | Azure AD tenant ID | `common` |
| `AZURE_CLIENT_ID` | Azure AD app registration client ID | Azure CLI public client |
| `AZURE_SUBSCRIPTION_ID` | Default subscription ID | None |
| `AZURE_CLOUD` | Azure cloud environment | `AzurePublic` |
| `LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |

### Config File (Optional)

Create `~/.logicapps-mcp/config.json`:

```json
{
  "tenantId": "your-tenant-id",
  "clientId": "your-client-id",
  "defaultSubscriptionId": "your-subscription-id"
}
```

### Azure Cloud Options

- `AzurePublic` (default)
- `AzureGovernment`
- `AzureChina`

## Usage with Claude Desktop

Add to your Claude Desktop configuration:
- **macOS**: `~/.config/claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "logicapps": {
      "command": "npx",
      "args": ["github:laveeshb/logicapps-mcp"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "logicapps": {
      "command": "logicapps-mcp"
    }
  }
}
```

## Usage with GitHub Copilot in VS Code

1. **Install the extension**: Ensure you have [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) and GitHub Copilot Chat installed

2. **Add MCP server via UI**:
   - Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - Search for "MCP: Add Server" or look for MCP settings in Copilot Chat
   - Add a new server with command: `logicapps-mcp`

   Alternatively, create/edit `.vscode/mcp.json` in your workspace:

   ```json
   {
     "servers": {
       "logicapps": {
         "type": "stdio",
         "command": "logicapps-mcp"
       }
     }
   }
   ```

3. **Reload VS Code** (`Ctrl+Shift+P`  "Developer: Reload Window")

4. **Use in Copilot Chat**: Open Copilot Chat and ask questions like:
   - "List my Azure subscriptions"
   - "Show Logic Apps in subscription xyz"
   - "What workflows failed in the last 24 hours?"

> **Tip:** Ensure you've run `az login` before starting VS Code.

## Cloud Agent

Deploy an AI-powered agent to Azure that can investigate and manage Logic Apps on your behalf.

### Prerequisites

- Azure CLI (`az login`)
- Azure Functions Core Tools (`func`)
- Node.js and npm
- An Azure OpenAI resource with a gpt-4o deployment (or let the script create one)

### Deploy

```powershell
# PowerShell - Use existing Azure OpenAI
./deploy/deploy.ps1 -ResourceGroup my-rg -AiFoundryEndpoint https://my-openai.openai.azure.com -CreateResourceGroup

# PowerShell - Create new Azure OpenAI resource
./deploy/deploy.ps1 -ResourceGroup my-rg -CreateAiResource -CreateResourceGroup

# Bash - Use existing Azure OpenAI
./deploy/deploy.sh -g my-rg --ai-endpoint https://my-openai.openai.azure.com --create-rg

# Bash - Create new Azure OpenAI resource
./deploy/deploy.sh -g my-rg --create-ai-resource --create-rg
```

The script will:
1. Create infrastructure (Function App, Storage, App Insights, Managed Identity)
2. Create Azure OpenAI resource and gpt-4o deployment (if `--create-ai-resource` is used)
3. Configure Easy Auth (only you can access the API)
4. Build and deploy the function code
5. Grant Azure OpenAI RBAC access (if `--create-ai-resource` is used)

### Grant RBAC Access

After deployment, grant the managed identity access to your Logic Apps:

```bash
# Grant access to Logic Apps (Reader for read-only, Logic App Contributor for write)
az role assignment create \
  --assignee <managed-identity-principal-id> \
  --role "Reader" \
  --scope /subscriptions/<subscription-id>
```

If you used an existing Azure OpenAI resource (not `--create-ai-resource`), also grant access to it:

```bash
az role assignment create \
  --assignee <managed-identity-principal-id> \
  --role "Cognitive Services OpenAI User" \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<openai-resource>
```

### Call the Agent

```bash
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)

curl -X POST "https://<app>.azurewebsites.net/api/agent" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "List my Azure subscriptions"}'
```

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/health` | Health check |
| `/api/mcp` | Raw MCP protocol (JSON-RPC) |
| `/api/agent` | AI-powered agent (natural language) |

## Authentication

This MCP server uses Azure CLI for authentication. Before using it, ensure you're logged in:

```bash
az login
```

The MCP server will automatically use the Azure CLI's tokens. Tokens are refreshed automatically by Azure CLI.

### Required Azure Permissions

The authenticated user needs:

| Role | Scope | Purpose |
|------|-------|---------|
| `Logic App Contributor` | Subscription/RG/Resource | Create, update, delete workflows; run triggers |
| `Reader` | Subscription/RG | List resources and resource groups |

> **Note**: For read-only access, `Logic App Reader` is sufficient.

## Available Tools

### Discovery & Navigation

| Tool | Description |
|------|-------------|
| `list_subscriptions` | List all accessible Azure subscriptions |
| `list_logic_apps` | List Logic Apps in a subscription (filter by SKU) |
| `list_workflows` | List workflows within a Standard Logic App |

### Workflow Definitions

| Tool | Description |
|------|-------------|
| `get_workflow_definition` | Get workflow JSON definition |
| `get_workflow_swagger` | Get OpenAPI/Swagger definition for a workflow |
| `list_workflow_versions` | List all versions of a Consumption Logic App |
| `get_workflow_version` | Get a specific historical version's definition (Consumption only) |

### Triggers

| Tool | Description |
|------|-------------|
| `get_workflow_triggers` | Get trigger information and execution times |
| `get_trigger_history` | Get execution history of a specific trigger |
| `get_trigger_callback_url` | Get callback URL for request-based triggers |

### Run History & Debugging

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

### Connections & Connectors

| Tool | Description |
|------|-------------|
| `get_connections` | List API connections in a resource group |
| `get_connection_details` | Get detailed information about a specific API connection |
| `test_connection` | Test if an API connection is valid and healthy |
| `create_connection` | Create a new API connection for a managed connector |
| `get_connector_swagger` | Get OpenAPI/Swagger definition for a managed connector |
| `invoke_connector_operation` | Invoke dynamic operations to fetch schemas, tables, queues, etc. |

### Write Operations

| Tool | Description |
|------|-------------|
| `enable_workflow` | Enable a disabled workflow |
| `disable_workflow` | Disable an active workflow |
| `run_trigger` | Manually fire a workflow trigger |
| `cancel_run` | Cancel a running or waiting workflow run |
| `create_workflow` | Create a new workflow (Consumption: new Logic App; Standard: new workflow) |
| `update_workflow` | Update an existing workflow's definition |
| `delete_workflow` | Delete a workflow (use with caution) |

### Host & Diagnostics (Standard SKU)

| Tool | Description |
|------|-------------|
| `get_host_status` | Get host status for Standard Logic Apps (runtime version, diagnostics) |

## Available Prompts

MCP Prompts provide AI assistants with guidance on tool selection and common workflows.

| Prompt | Description |
|--------|-------------|
| `logic-apps-guide` | System guidance covering SKU differences, debugging workflows, and tool selection tips |

> **Note**: Prompt availability depends on the MCP client. Claude Desktop supports prompts; GitHub Copilot does not yet.

## Example Prompts

Once configured with an AI assistant, you can ask:

### Reading
- "List all my Azure subscriptions"
- "Show me the Logic Apps in subscription xyz"
- "What workflows are in my-logic-app?"
- "Show me the definition of the order-processing workflow"
- "List failed runs from the last 24 hours"
- "What actions ran in run ID abc123?"

### Writing
- "Disable the order-processing workflow"
- "Run the manual trigger on my-workflow"
- "Cancel the currently running workflow"
- "Update the workflow to add a new HTTP action"

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Architecture

See [design/README.md](design/README.md) for implementation details.

## License

MIT