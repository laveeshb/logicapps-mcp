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

## Choose Your Setup

| | Local MCP Server | Cloud Agent |
|--|------------------|-------------|
| **Use when** | You have a local AI (Copilot, Claude) and can `az login` to access the Logic Apps | You need shared/audited access, or can't access Logic Apps directly |
| **Setup** | `npm install` + AI config | Deploy to Azure |
| **Auth** | Your Azure CLI credentials | Managed Identity |

See the [Getting Started Guide](docs/GETTING_STARTED.md) for detailed setup instructions.

## Quick Start (Local MCP Server)

```bash
# 1. Install
npm install -g github:laveeshb/logicapps-mcp

# 2. Login to Azure
az login

# 3. Add to your AI assistant and restart (see Getting Started Guide)
```

## Quick Start (Cloud Agent)

```bash
# Deploy to Azure (creates everything including Azure OpenAI)
./deploy/deploy.ps1 -ResourceGroup my-rg -CreateAiResource -CreateResourceGroup

# Grant the managed identity access to your Logic Apps
az role assignment create \
  --assignee <managed-identity-id-from-output> \
  --role "Reader" \
  --scope /subscriptions/<subscription-id>
```

## Features

- **37 Tools** for Logic Apps operations: list, debug, create, update, delete workflows
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

- [Getting Started Guide](docs/GETTING_STARTED.md) - Setup for Claude, Copilot, Cloud Agent
- [Available Tools](docs/TOOLS.md) - All 37 tools with descriptions
- [Cloud Agent](docs/CLOUD_AGENT.md) - Deployment and configuration details
- [Configuration](docs/CONFIGURATION.md) - Environment variables, auth, SKU differences

## Development

```bash
npm run dev      # Run in development mode
npm test         # Run tests
```

## License

MIT
