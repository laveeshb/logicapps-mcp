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

# Call the agent
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)
curl -X POST "https://<app>.azurewebsites.net/api/agent" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "List failed runs in the last 24 hours"}'
```

## When to Use Each

### Local MCP Server

Best for developers who:
- Have GitHub Copilot, Claude Desktop, or another MCP-compatible AI
- Can authenticate via `az login` to access target Logic Apps
- Want quick, interactive debugging sessions

### Cloud Agent

Best for scenarios where:
- **Enterprise policies** restrict individual access to production resources
- Teams need **shared, audited access** through a controlled identity
- You want to **investigate Logic Apps across subscriptions** you don't personally have access to
- No local AI assistant is available
- You need a **REST API** for automation or integration

## Comparison

| Aspect | Local MCP Server | Cloud Agent |
|--------|------------------|-------------|
| **Setup** | `npm install` + AI config | Deploy to Azure |
| **AI Model** | Your local AI (Copilot, Claude) | Azure OpenAI (gpt-4o) |
| **Auth** | Your Azure CLI credentials | Managed Identity |
| **Access Scope** | What *you* can access | What the *managed identity* can access |
| **Audit Trail** | Local only | Azure Monitor / App Insights |
| **Best For** | Individual developers | Teams, enterprise, automation |

## Next Steps

- [Available Tools](TOOLS.md) - See all 37 tools
- [Configuration](CONFIGURATION.md) - Environment variables, auth, SKU differences
- [Cloud Agent](CLOUD_AGENT.md) - Deployment details
