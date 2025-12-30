# Getting Started

This guide helps you choose the right setup and get started with AI-powered Logic Apps management.

## Decision Flowchart

```
        Can you access the Logic Apps
        you want to manage? (via az login)
                    │
         ┌──────────┴──────────┐
         │                     │
        YES                    NO
         │                     │
         ▼                     │
    Do you have a              │
    local AI assistant?        │
    (Copilot, Claude)          │
         │                     │
    ┌────┴────┐                │
    │         │                │
   YES        NO ──────────────┤
    │                          │
    ▼                          ▼
┌─────────────────┐    ┌─────────────────┐
│ Local MCP Server│    │   Cloud Agent   │
│                 │    │                 │
│ npm install +   │    │ Deploy to Azure │
│ AI config       │    │ REST API access │
└─────────────────┘    └─────────────────┘
```

| Aspect | Local MCP Server | Cloud Agent |
|--------|------------------|-------------|
| **Setup** | `npm install` + AI config | Deploy to Azure |
| **AI Model** | Your local AI (Copilot, Claude) | Azure OpenAI |
| **API Auth** | Your Azure CLI credentials | Your identity (via Easy Auth) |
| **Resource Access** | What *you* can access | What the *managed identity* can access |
| **Best For** | Individual developers | Teams, enterprise, automation |

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

## Cloud Agent Setup

See [Cloud Agent](CLOUD_AGENT.md) for detailed deployment instructions.

### Quick Deploy

```bash
# Deploy (creates Azure OpenAI resource for you)
./deploy/deploy.ps1 -ResourceGroup my-rg -CreateAiResource -CreateResourceGroup

# Grant the managed identity access to your Logic Apps
az role assignment create \
  --assignee <managed-identity-id-from-output> \
  --role "Reader" \
  --scope /subscriptions/<subscription-id>

# Call the agent (be specific - open-ended queries may time out)
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)
curl -X POST "https://<app>.azurewebsites.net/api/agent" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Get error details for run 08585373430220335253625502230CU00 of workflow order-processing in Logic App contoso-app"}'
```

## Next Steps

- [Available Tools](TOOLS.md) - See all 37 tools
- [Configuration](CONFIGURATION.md) - Environment variables, auth, SKU differences
- [Cloud Agent](CLOUD_AGENT.md) - Deployment details
