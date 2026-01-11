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

Works with **GitHub Copilot**, **Claude Desktop**, or any MCP-compatible AI client. Supports both Consumption and Standard Logic Apps.

## Choose Your Setup

| | Local MCP Server | Cloud MCP Server |
|--|------------------|------------------|
| **Use when** | You have a local AI (Copilot, Claude) | You need a hosted MCP server for remote AI clients |
| **Setup** | `npm install` + AI config | Deploy to Azure |
| **Auth** | Your Azure CLI credentials | Passthrough (client provides bearer token) |

See the [Getting Started Guide](docs/GETTING_STARTED.md) for detailed setup instructions.

## Quick Start (Local MCP Server)

```bash
# 1. Install
npm install -g logicapps-mcp

# 2. Login to Azure
az login

# 3. Add to your AI assistant and restart (see Getting Started Guide)
```

## Quick Start (Cloud MCP Server)

Deploy a hosted MCP server with passthrough authentication. Clients must provide their own ARM-scoped bearer token.

```bash
# Deploy to Azure
./deploy/deploy.ps1 -ResourceGroup my-rg -CreateResourceGroup

# Test the endpoint
$token = az account get-access-token --resource https://management.azure.com --query accessToken -o tsv
curl -H "Authorization: Bearer $token" https://<app>.azurewebsites.net/api/health
```

**Authentication Model**: The cloud MCP server uses passthrough authentication. It does not have its own Azure access—clients must provide an ARM-scoped bearer token in the `Authorization` header. The server uses this token directly for all Azure Resource Manager API calls. Users only see resources they have access to with their own Azure credentials.

## Features

- **40 Tools** for Logic Apps operations: list, debug, create, update, delete workflows
- **Dual SKU Support**: Works with both Consumption and Standard Logic Apps
- **Run Debugging**: Trace failures through actions, loops, and scopes
- **Write Operations**: Create workflows, run triggers, cancel runs
- **Connector Support**: Discover connectors, create connections

## Example Prompts

```
"List my Logic Apps in subscription xyz"
"Show failed runs from the last 24 hours"
"What went wrong in run ID abc123?"
"Add retry logic to the HTTP action"
"Disable the order-processing workflow"
```

## Documentation

- [Getting Started Guide](docs/GETTING_STARTED.md) - Setup for Claude, Copilot, Cloud MCP Server
- [Available Tools](docs/TOOLS.md) - All 40 tools with descriptions
- [Configuration](docs/CONFIGURATION.md) - Environment variables, auth, SKU differences
- [Changelog](CHANGELOG.md) - Release history

## Development

```bash
npm run dev              # Run in development mode
npm test                 # Run unit tests
npm run test:integration # Run integration tests (requires Azure setup)
npm run test:all         # Run all tests
```

### Integration Testing

Integration tests run against real Azure resources. They auto-discover your subscriptions and Logic Apps:

```bash
az login                     # Login to Azure
npm run test:integration     # Tests find resources automatically
```

## License

MIT
