# Getting Started

This guide helps you choose the right setup and get started with AI-powered Logic Apps management.

## Decision Flowchart

```
        Do you have a local AI assistant?
        (GitHub Copilot, Claude Desktop, Cursor)
                    │
         ┌──────────┴──────────┐
         │                     │
        YES                    NO
         │                     │
         ▼                     ▼
┌─────────────────┐    ┌─────────────────┐
│ Local MCP Server│    │ Cloud MCP Server│
│                 │    │                 │
│ npm install +   │    │ Deploy to Azure │
│ AI config       │    │ + remote AI     │
└─────────────────┘    └─────────────────┘

Both options require Azure access (az login) to get credentials.
```

| Aspect | Local MCP Server | Cloud MCP Server |
|--------|------------------|------------------|
| **Setup** | `npm install` + AI config | Deploy to Azure |
| **AI Model** | Your local AI (Copilot, Claude) | Bring your own AI client |
| **API Auth** | Your Azure CLI credentials | Passthrough (client provides bearer token) |
| **Resource Access** | What *you* can access | What *the token holder* can access |
| **Best For** | Individual developers | Remote/hosted AI integrations |

## Local MCP Server Setup

### Prerequisites

- [Azure CLI](https://aka.ms/installazurecli) installed and authenticated (`az login`)
- Node.js 20+
- GitHub Copilot or Claude Desktop

### Step 1: Install

```bash
npm install -g github:laveeshb/logicapps-mcp
```

### Step 2: Login to Azure

```bash
az login
```

### Step 3: Configure Your AI Assistant

#### GitHub Copilot in VS Code

1. Install [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) and GitHub Copilot Chat extensions

2. Create/edit `.vscode/mcp.json` in your workspace:

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

3. Reload VS Code (`Ctrl+Shift+P` → "Developer: Reload Window")

4. Open Copilot Chat and start asking questions

> **Tip:** Ensure you've run `az login` before starting VS Code.

#### Claude Desktop

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

Restart Claude Desktop after saving.

### Step 4: Test It

Try these prompts:
- "List my Azure subscriptions"
- "Show Logic Apps in subscription xyz"
- "What workflows failed in the last 24 hours?"

## Cloud MCP Server Setup

Deploy a hosted MCP server to Azure. The server uses **passthrough authentication**—it has no Azure credentials of its own. Clients must provide an ARM-scoped bearer token in the `Authorization` header.

### Prerequisites

1. Azure subscription
2. Azure CLI installed and authenticated (`az login`)
3. Azure Functions Core Tools (`npm install -g azure-functions-core-tools@4`)
4. Node.js 20+

### Step 1: Deploy

```bash
# PowerShell
./deploy/deploy.ps1 -ResourceGroup my-rg -CreateResourceGroup

# Bash
./deploy/deploy.sh -g my-rg --create-rg
```

This creates:
- **Function App** - Hosts the MCP server
- **Storage Account** - Required for Functions runtime
- **Application Insights** - Telemetry and monitoring

### Step 2: Test the Deployment

```bash
# Get an ARM-scoped token
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)

# Test health endpoint
curl -H "Authorization: Bearer $TOKEN" https://<your-app>.azurewebsites.net/api/health

# Expected: {"status":"ok","version":"0.2.0"}
```

### Step 3: Connect Your AI Client

The MCP endpoint is available at:
```
https://<your-app>.azurewebsites.net/api/mcp
```

Configure your AI client to:
1. Send requests to the MCP endpoint
2. Include `Authorization: Bearer <ARM-token>` header
3. Use the MCP protocol (JSON-RPC over HTTP)

### Authentication Model

The cloud MCP server uses **passthrough authentication**:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    AI Client     │ ──> │    MCP Server    │ ──> │    Azure ARM     │
│                  │     │  (Function App)  │     │      APIs        │
└──────────────────┘     └──────────────────┘     └──────────────────┘
          │                        │                        │
          │ Authorization:         │ Uses client's          │
          │ Bearer <ARM-token>     │ token directly         │
          └────────────────────────┴────────────────────────┘
```

- **No managed identity for ARM**: The server doesn't have its own Azure access
- **Token required**: Every request must include an ARM-scoped bearer token
- **User-scoped access**: Users only see resources they have access to
- **No token = error**: Requests without a valid token will fail

### Getting an ARM Token

```bash
# Azure CLI
az account get-access-token --resource https://management.azure.com --query accessToken -o tsv

# PowerShell
$token = (Get-AzAccessToken -ResourceUrl https://management.azure.com).Token
```

## Next Steps

- [Available Tools](TOOLS.md) - See all 37 tools
- [Configuration](CONFIGURATION.md) - Environment variables and authentication
