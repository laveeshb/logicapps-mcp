# Getting Started

This guide helps you choose the right setup for using AI with Azure Logic Apps.

## Decision Flowchart

```
        ┌──────────────────────────────────────────┐
        │  Can you directly access the Logic Apps  │
        │  you want to manage? (via az login)      │
        └─────────────────┬────────────────────────┘
                          │
           ┌──────────────┴──────────────┐
           │                             │
          YES                            NO ─────────────────────┐
           │                                                     │
           ▼                                                     │
        ┌─────────────────────────────────┐                      │
        │  Do you have a local AI?        │                      │
        │  (GitHub Copilot, Claude, etc.) │                      │
        └────────────────┬────────────────┘                      │
                         │                                       │
          ┌──────────────┴──────────────┐                        │
          │                             │                        │
         YES                            NO ──────────────────────┤
          │                                                      │
          ▼                                                      ▼
┌───────────────────────┐                     ┌────────────────────────────────┐
│   Local MCP Server    │                     │        Cloud Agent             │
│                       │                     │                                │
│ • Install via npm     │                     │ • Deploy to Azure (Bicep)      │
│ • Connect to your AI  │                     │ • Managed identity for access  │
│ • Uses your az login  │                     │ • Call via REST API            │
│                       │                     │                                │
│ → See Quick Start     │                     │ → See Cloud Agent section      │
│   in README           │                     │   in README                    │
└───────────────────────┘                     └────────────────────────────────┘
```

## When to Use Each

### Local MCP Server

Best for developers who:
- Have GitHub Copilot, Claude Desktop, or another MCP-compatible AI
- Can authenticate via `az login` to access target Logic Apps

**How it works:** You install the MCP server locally, connect it to your AI assistant, and it uses your Azure CLI credentials to access Logic Apps.

```bash
# Install
npm install -g github:laveeshb/logicapps-mcp

# Login to Azure
az login

# Configure your AI (see README for Claude/Copilot setup)
```

### Cloud Agent

Best for scenarios where:
- **Enterprise policies** restrict individual access to production resources
- Teams need **shared, audited access** through a controlled identity
- You want to **investigate Logic Apps across subscriptions** you don't personally have access to
- No local AI assistant is available
- You need a **REST API** for automation or integration

**How it works:** You deploy a Function App to Azure with a managed identity. The managed identity has RBAC access to the Logic Apps you want to investigate. Users call the agent via REST API with Azure AD authentication.

```bash
# Deploy (creates Azure OpenAI resource for you)
./deploy/deploy.ps1 -ResourceGroup my-rg -CreateAiResource -CreateResourceGroup

# Or use an existing Azure OpenAI resource
./deploy/deploy.ps1 -ResourceGroup my-rg -AiFoundryEndpoint https://my-openai.openai.azure.com
```

The script handles everything: infrastructure, Azure OpenAI setup, code build/deploy, and Easy Auth configuration. After deployment, grant the managed identity access to your Logic Apps:

```bash
az role assignment create \
  --assignee <managed-identity-principal-id> \
  --role "Reader" \
  --scope /subscriptions/<subscription-id>
```

Then call the agent:

```bash
TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)
curl -X POST "https://<app>.azurewebsites.net/api/agent" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "List failed runs in the last 24 hours"}'
```

## Comparison

| Aspect | Local MCP Server | Cloud Agent |
|--------|------------------|-------------|
| **Setup** | `npm install` + AI config | Deploy to Azure (Bicep) |
| **AI Model** | Your local AI (Copilot, Claude) | Azure OpenAI (gpt-4o) |
| **Auth** | Your Azure CLI credentials | Managed Identity |
| **Access Scope** | What *you* can access | What the *managed identity* can access |
| **Audit Trail** | Local only | Azure Monitor / App Insights |
| **Best For** | Individual developers | Teams, enterprise, automation |

## Enterprise Scenarios

The Cloud Agent is particularly useful in enterprise environments:

### Restricted Production Access
Many organizations don't allow individual developers to have direct access to production Logic Apps. With the Cloud Agent:
- Deploy the agent with a managed identity that has production access
- Developers call the agent API (with their own Azure AD auth)
- The agent investigates on their behalf using the managed identity
- All access is logged in App Insights

### Cross-Team Investigation
When you need to investigate Logic Apps owned by another team:
- The other team grants the agent's managed identity `Reader` access
- You can investigate their Logic Apps without needing direct access yourself

### Compliance and Audit
- All agent calls are logged with the caller's identity
- The managed identity's access is controlled via RBAC
- No credentials are shared between users

## Next Steps

- **Local MCP Server:** See [Quick Start](../README.md#quick-start) in the README
- **Cloud Agent:** See [Cloud Agent](../README.md#cloud-agent) in the README
