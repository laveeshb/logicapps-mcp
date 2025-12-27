---
version: 0.2.0
lastUpdated: 2025-12-26
---

# Logic Apps AI Assistant - Cloud Solution

## Overview

A cloud-hosted solution for customers without AI subscriptions, using:
- **Logic Apps Agent Loop** - Built-in agentic workflow capability
- **Function App as MCP Server** - Hosts the same 36 tools as the local solution
- **Azure AI Foundry** - Pay-per-use LLM access

---

## Target Users

| Profile | Details |
|---------|---------|
| **Organizations** | Azure subscription but no AI assistant tools |
| **LLM** | Pay-per-use via Azure AI Foundry |
| **Cost** | Azure AI Foundry consumption + Logic Apps Standard (WS1) + Function App (EP1) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Customer's Azure Subscription                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ User-Assigned Managed Identity ──────────────────────────────────────┐ │
│  │  Name: logicapps-assistant-identity                                    │ │
│  │  Roles:                                                                │ │
│  │  • Logic App Contributor (subscription scope)                          │ │
│  │  • Reader (subscription scope)                                         │ │
│  │  • Cognitive Services User (AI Foundry resource)                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│         │ Assigned to both ↓                                                │
│         ├────────────────────────────────────────────────────────┐          │
│         ▼                                                        ▼          │
│  ┌─ Logic App Standard (WS1) ─────────────────┐  ┌─ Function App (EP1) ───┐│
│  │  Agent Loop Workflow                        │  │  MCP Server            ││
│  │                                             │  │                        ││
│  │  ┌─ Agent Action ────────────────────────┐ │  │  Same 36 tools as      ││
│  │  │  AI Model: Azure AI Foundry (GPT-4o)  │ │  │  local MCP server:     ││
│  │  │                                       │ │  │  • 33 LA operations    ││
│  │  │  MCP Server: "Bring Your Own"         │ │  │  • 3 Knowledge tools   ││
│  │  │  └─ URL: https://mcp-server...        │─┼──│                        ││
│  │  │  └─ Auth: Managed Identity            │ │  │  Bundled docs          ││
│  │  │                                       │ │  │  HTTP SSE transport    ││
│  │  │  Discovers 36 tools automatically     │ │  │                        ││
│  │  └───────────────────────────────────────┘ │  │  Easy Auth: Only MI    ││
│  │                                             │  │  allowed               ││
│  │  Easy Auth: Customer-configured callers    │  └────────────────────────┘│
│  │  (Teams bot, users, etc.)                  │           │                │
│  └─────────────────────────────────────────────┘           │                │
│                    │                                       │                │
│                    │                                       │                │
│                    ▼                                       ▼                │
│  ┌─ Azure AI Foundry ──────────────────┐  ┌─ Azure Resource Manager ──────┐│
│  │  GPT-4o deployment                   │  │  Logic Apps REST APIs         ││
│  │  Pay-per-token                       │  │  (management.azure.com)       ││
│  └──────────────────────────────────────┘  └──────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Logic Apps Agent Loop

The Agent Loop is a built-in Logic Apps capability that:
- Manages the LLM conversation loop
- Discovers tools from connected MCP servers
- Executes tool calls and aggregates responses
- Provides a built-in chat UI

**Reference**: [Announcing MCP Server Support for Logic Apps Agent Loop](https://techcommunity.microsoft.com/blog/integrationsonazureblog/announcing-mcp-server-support-for-logic-apps-agent-loop/4470778)

### 2. Function App as MCP Server

The same TypeScript code as the local solution, deployed to Azure Functions with HTTP transport:

```typescript
// Local: stdio transport
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
const transport = new StdioServerTransport();

// Cloud: HTTP SSE transport
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
const transport = new StreamableHTTPServerTransport({ ... });
```

### 3. MCP Server Integration Options

From the Agent Loop announcement, there are three ways to add MCP tools:

| Option | Description | Our Use |
|--------|-------------|---------|
| **Bring Your Own MCP** | Point to any external MCP server via URL | ✅ Our Function App |
| **Managed MCP** | Azure-hosted MCP servers (O365, GitHub, etc.) | Not needed |
| **Custom MCP** | Publish OpenAPI-based MCP connector | Future option |

---

## Authentication Architecture

### Zero-Secrets Design

All authentication uses Managed Identity - no secrets stored anywhere.

```
┌─ User-Assigned Managed Identity ────────────────────────────────────────────┐
│  Assigned to: Logic App + Function App                                      │
│                                                                              │
│  Flow 1: Logic App → Function App (MCP Server)                              │
│  ├─ Logic App requests token with audience: api://mcp-server                │
│  ├─ Function App Easy Auth validates token                                  │
│  └─ Only this specific MI is allowed (allowedPrincipals)                    │
│                                                                              │
│  Flow 2: Logic App → Azure AI Foundry                                       │
│  ├─ Logic App requests token with audience: cognitiveservices.azure.com    │
│  └─ MI has "Cognitive Services User" role on AI Foundry resource           │
│                                                                              │
│  Flow 3: Function App → Azure Resource Manager                              │
│  ├─ Function App requests token with audience: management.azure.com        │
│  └─ MI has "Logic App Contributor" role on subscription                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Easy Auth Configuration

**Function App** (MCP Server) - Only accepts tokens from the Managed Identity:

```json
{
  "identityProviders": {
    "azureActiveDirectory": {
      "enabled": true,
      "validation": {
        "allowedAudiences": ["api://mcp-server"],
        "defaultAuthorizationPolicy": {
          "allowedPrincipals": {
            "identities": ["<managed-identity-object-id>"]
          }
        }
      }
    }
  }
}
```

**Logic App** - Accepts tokens from customer-configured callers:

```json
{
  "identityProviders": {
    "azureActiveDirectory": {
      "enabled": true,
      "validation": {
        "allowedAudiences": ["api://agent-loop"],
        "defaultAuthorizationPolicy": {
          "allowedPrincipals": {
            "identities": [
              "<teams-bot-object-id>",
              "<user-group-object-id>"
            ]
          }
        }
      }
    }
  }
}
```

---

## Role Assignments

| Identity | Role | Scope | Purpose |
|----------|------|-------|---------|
| User-Assigned MI | `Logic App Contributor` | Subscription(s) | Create/update/manage Logic Apps |
| User-Assigned MI | `Reader` | Subscription(s) | List resources |
| User-Assigned MI | `Cognitive Services User` | AI Foundry resource | Call GPT-4o |

---

## Deployment

### Prerequisites

1. Azure subscription with:
   - Logic Apps Standard capability
   - Azure AI Foundry with GPT-4o deployment
   - Ability to create Function Apps

2. Permissions to:
   - Create Managed Identity
   - Assign roles at subscription level
   - Configure Easy Auth

### Resource Costs (Estimated)

| Resource | SKU | Estimated Cost |
|----------|-----|----------------|
| Logic App Standard | WS1 | ~$175/month |
| Function App | EP1 | ~$150/month |
| AI Foundry (GPT-4o) | Pay-per-use | ~$0.01/1K tokens |
| **Total (idle)** | | **~$325/month** |

### Deployment Options

#### Option A: Bicep Template

```bicep
// Main deployment
param location string = resourceGroup().location
param baseName string = 'logicapps-assistant'

// User-Assigned Managed Identity
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${baseName}-identity'
  location: location
}

// Function App (MCP Server)
resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${baseName}-mcp'
  location: location
  kind: 'functionapp'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    // ...
  }
}

// Logic App Standard
resource logicApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${baseName}-agent'
  location: location
  kind: 'functionapp,workflowapp'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    // ...
  }
}

// Role assignments
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, managedIdentity.id, 'Logic App Contributor')
  scope: subscription()
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '87a39d53-fc1b-424a-814c-f7e04687dc9e' // Logic App Contributor
    )
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}
```

#### Option B: ARM Template

Full ARM template available in `deploy/arm/azuredeploy.json`.

#### Option C: Azure Portal Wizard

Step-by-step guide for portal deployment:

1. Create User-Assigned Managed Identity
2. Create Function App with MCP server code
3. Create Logic App Standard with Agent Loop workflow
4. Configure MCP server connection in Agent Loop
5. Set up Easy Auth on both resources
6. Assign roles to Managed Identity

---

## Agent Loop Configuration

### Adding the MCP Server

In the Logic App Agent Loop action:

1. Under **MCP Servers**, select **Add MCP Server**
2. Choose **Bring Your Own MCP**
3. Enter the Function App URL: `https://<function-app>.azurewebsites.net`
4. Configure authentication:
   - Type: Managed Identity
   - Identity: Select the User-Assigned MI
   - Audience: `api://mcp-server`

### Agent Instructions

```markdown
You are an Azure Logic Apps expert assistant. You help users debug, author, 
and manage Logic Apps.

## Your Capabilities
- List and inspect Logic Apps (Consumption and Standard SKUs)
- Investigate failed workflow runs
- Debug expressions, connections, and trigger issues
- Help create and modify workflows
- Explain SKU differences and best practices

## Debugging Workflow
1. Identify the Logic App using list_logic_apps
2. Get recent failed runs using search_runs with status='Failed'
3. Use get_run_actions to find which action failed
4. Use get_action_io to see the actual error message
5. Call appropriate troubleshooting guide for context

## Key Patterns
- Always check get_action_io for actual error details
- Standard SKU requires workflowName parameter; Consumption doesn't
- For loops, use get_action_repetitions to see individual iterations
```

---

## User Channels

The Agent Loop can be triggered from multiple channels:

| Channel | Trigger | Notes |
|---------|---------|-------|
| **Built-in Chat** | Portal UI | For testing and internal use |
| **HTTP** | Request trigger | For API integration |
| **Teams** | Teams webhook | Via Power Automate or direct |
| **Slack** | Slack webhook | Via connector |
| **Email** | Outlook trigger | Parse email for intent |

---

## User Experience

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Logic Apps Portal - Chat UI                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User: Why is my order-processor failing?                                   │
│                                                                             │
│  Assistant: I'll investigate the order-processor Logic App for you.         │
│                                                                             │
│  [Calling list_logic_apps...]                                               │
│  [Calling search_runs with status='Failed'...]                              │
│  [Calling get_run_actions...]                                               │
│  [Calling get_action_io...]                                                 │
│                                                                             │
│  I found the issue! The Parse_JSON action is failing because the HTTP       │
│  response body is null when the external API returns a 204 No Content.      │
│                                                                             │
│  Here's how to fix it:                                                      │
│  1. Add a condition after the HTTP action to check the status code          │
│  2. Only run Parse_JSON when status code is 200                             │
│  3. Handle 204 separately with a default response                           │
│                                                                             │
│  Would you like me to help you update the workflow definition?              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

### Data Boundaries

- Agent only accesses Logic Apps in the customer's subscription
- MCP Server only accepts requests from the Agent Loop (via Easy Auth)
- All API calls authenticated via Managed Identity
- No secrets stored in configuration

### Network Isolation (Optional)

For enhanced security, deploy with VNet integration:

```
┌─ VNet ───────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─ Subnet: agent ──────────┐    ┌─ Subnet: mcp ────────────────────────┐  │
│  │  Logic App Standard       │    │  Function App                        │  │
│  │  (VNet integrated)        │◄───│  (VNet integrated)                   │  │
│  └───────────────────────────┘    └──────────────────────────────────────┘  │
│                                                                              │
│  Private endpoints for:                                                      │
│  • Azure AI Foundry                                                          │
│  • Azure Resource Manager (via Private Link)                                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 2a: Add HTTP Transport to MCP Server

| Task | Status |
|------|--------|
| Add `StreamableHTTPServerTransport` | 🔲 TODO |
| Create Azure Functions wrapper | 🔲 TODO |
| Test with VS Code MCP client | 🔲 TODO |
| Document deployment steps | 🔲 TODO |

### Phase 2b: Agent Loop Workflow

| Task | Status |
|------|--------|
| Create agent-loop workflow template | 🔲 TODO |
| Configure MCP server connection | 🔲 TODO |
| Set up Easy Auth | 🔲 TODO |
| Test end-to-end | 🔲 TODO |

### Phase 2c: Deployment Package

| Task | Status |
|------|--------|
| Bicep template | 🔲 TODO |
| ARM template | 🔲 TODO |
| Portal deployment guide | 🔲 TODO |
| Cost estimation guide | 🔲 TODO |

---

## References

- [Announcing MCP Server Support for Logic Apps Agent Loop](https://techcommunity.microsoft.com/blog/integrationsonazureblog/announcing-mcp-server-support-for-logic-apps-agent-loop/4470778)
- [Create MCP servers in API Center based on Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/create-mcp-server-api-center)
- [Agent Loop Labs](https://aka.ms/agentloop/mcp)
- [AI agent workflows in Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/agent-workflows-concepts)
