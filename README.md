# logicapps-mcp

<img src="https://raw.githubusercontent.com/benc-uk/icon-collection/master/azure-icons/Logic-Apps.svg" alt="Azure Logic Apps" width="80" align="right">

An MCP (Model Context Protocol) server that enables AI assistants to interact with Azure Logic Apps. Supports both **Consumption** and **Standard** Logic Apps SKUs with read-only operations.

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage with Claude Desktop](#usage-with-claude-desktop)
- [Usage with GitHub Copilot in VS Code](#usage-with-github-copilot-in-vs-code)
- [Authentication](#authentication)
- [Available Tools](#available-tools)
- [Example Prompts](#example-prompts)
- [Development](#development)
- [Architecture](#architecture)

## Quick Start

### Prerequisites

- [Azure CLI](https://aka.ms/installazurecli) installed and authenticated (`az login`)
- Node.js 20+

### Install

``bash
# 1. Install globally
npm install -g @laveeshb/logicapps-mcp

# 2. Login to Azure CLI
az login

# 3. Add to your AI assistant (see sections below) and restart
``

## Features

- **Dual SKU Support**: Works with both Consumption (`Microsoft.Logic/workflows`) and Standard (`Microsoft.Web/sites`) Logic Apps
- **18 Read-Only Tools**: Comprehensive toolset for subscriptions, logic apps, workflows, triggers, runs, actions, connections, and more
- **Multi-Cloud**: Supports Azure Public, Government, and China clouds
- **Secure Authentication**: Uses Azure CLI tokens with automatic refresh
- **No Azure SDK**: Pure REST API implementation with minimal dependencies

## Installation

### Via npm

``bash
npm install -g @laveeshb/logicapps-mcp
``

Or use directly with npx:

``bash
npx @laveeshb/logicapps-mcp
``

### From Source

``bash
git clone https://github.com/laveeshb/logicapps-mcp.git
cd logicapps-mcp
npm install
npm run build
``

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

``json
{
  "tenantId": "your-tenant-id",
  "clientId": "your-client-id",
  "defaultSubscriptionId": "your-subscription-id"
}
``

### Azure Cloud Options

- `AzurePublic` (default)
- `AzureGovernment`
- `AzureChina`

## Usage with Claude Desktop

Add to your Claude Desktop configuration:
- **macOS**: `~/.config/claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

``json
{
  "mcpServers": {
    "logicapps": {
      "command": "npx",
      "args": ["@laveeshb/logicapps-mcp"]
    }
  }
}
``

Or if installed globally:

``json
{
  "mcpServers": {
    "logicapps": {
      "command": "logicapps-mcp"
    }
  }
}
``

## Usage with GitHub Copilot in VS Code

1. **Install the extension**: Ensure you have [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) and GitHub Copilot Chat installed

2. **Add MCP server via UI**:
   - Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - Search for "MCP: Add Server" or look for MCP settings in Copilot Chat
   - Add a new server with command: `logicapps-mcp`

   Alternatively, create/edit `.vscode/mcp.json` in your workspace:

   ``json
   {
     "servers": {
       "logicapps": {
         "type": "stdio",
         "command": "logicapps-mcp"
       }
     }
   }
   ``

3. **Reload VS Code** (`Ctrl+Shift+P`  "Developer: Reload Window")

4. **Use in Copilot Chat**: Open Copilot Chat and ask questions like:
   - "List my Azure subscriptions"
   - "Show Logic Apps in subscription xyz"
   - "What workflows failed in the last 24 hours?"

> **Tip:** Ensure you've run `az login` before starting VS Code.

## Authentication

This MCP server uses Azure CLI for authentication. Before using it, ensure you're logged in:

``bash
az login
``

The MCP server will automatically use the Azure CLI's tokens. Tokens are refreshed automatically by Azure CLI.

### Required Azure Permissions

The authenticated user needs:

| Role | Scope | Purpose |
|------|-------|---------|
| `Logic App Reader` | Subscription/RG/Resource | Read workflow definitions and run history |
| `Reader` | Subscription/RG | List resources and resource groups |

## Available Tools

| Tool | Description |
|------|-------------|
| `list_subscriptions` | List all accessible Azure subscriptions |
| `list_logic_apps` | List Logic Apps in a subscription (filter by SKU) |
| `list_workflows` | List workflows within a Standard Logic App |
| `get_workflow_definition` | Get workflow JSON definition |
| `get_workflow_triggers` | Get trigger information and execution times |
| `list_run_history` | Get run history with optional filtering |
| `get_run_details` | Get details of a specific run |
| `get_run_actions` | Get action execution details for a run |
| `get_connections` | List API connections in a resource group |
| `get_host_status` | Get host status for Standard Logic Apps (runtime version, diagnostics) |
| `list_workflow_versions` | List all versions of a Consumption Logic App |
| `get_trigger_history` | Get execution history of a specific trigger |
| `get_action_repetitions` | Get iteration details for loop actions (ForEach, Until) |
| `get_action_request_history` | Get HTTP request/response details for webhook actions |
| `get_trigger_callback_url` | Get callback URL for request-based triggers |
| `get_scope_repetitions` | Get execution details for scope actions (Scope, Switch, Condition) |
| `get_expression_traces` | Get expression evaluation traces for an action |
| `get_workflow_swagger` | Get OpenAPI/Swagger definition for a workflow |

## Example Prompts

Once configured with an AI assistant, you can ask:

- "List all my Azure subscriptions"
- "Show me the Logic Apps in subscription xyz"
- "What workflows are in my-logic-app?"
- "Show me the definition of the order-processing workflow"
- "List failed runs from the last 24 hours"
- "What actions ran in run ID abc123?"

## Development

``bash
# Run in development mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
``

## Architecture

``
src/
 index.ts           # MCP server entry point
 server.ts          # Tool registration
 auth/              # Azure CLI token management
 config/            # Azure cloud endpoints & settings
 tools/             # MCP tool implementations (18 tools)
 types/             # TypeScript type definitions
 utils/             # HTTP client & error handling
``

## License

MIT

