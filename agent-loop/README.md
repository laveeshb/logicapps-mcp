# Logic Apps Agent Loop

This is a Logic App Standard workflow that implements an AI agent loop using the MCP server for tools.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HTTP Request (User Message)                                            │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Agent Loop Workflow                                                 ││
│  │                                                                      ││
│  │  1. Get tools from MCP Server (tools/list)                          ││
│  │  2. Convert to OpenAI function format                               ││
│  │  3. Call Azure AI Foundry with user message + tools                 ││
│  │  4. If tool_calls in response:                                      ││
│  │     - Execute each tool via MCP Server (tools/call)                 ││
│  │     - Add results to conversation                                   ││
│  │     - Loop back to step 3                                           ││
│  │  5. If no tool_calls: return final response                         ││
│  │                                                                      ││
│  └─────────────────────────────────────────────────────────────────────┘│
│         │                                                               │
│         ▼                                                               │
│  HTTP Response (AI Response)                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **MCP Server** deployed at `https://la-lamcp-mcp.azurewebsites.net`
2. **Azure AI Foundry** with GPT-4o deployment
3. **Managed Identity** with:
   - `Cognitive Services User` role on AI Foundry resource
   - Same identity used by the MCP server

## Configuration

### Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `mcpServerUrl` | URL of the MCP server endpoint | `https://la-lamcp-mcp.azurewebsites.net/api/mcp` |
| `aiModelEndpoint` | Azure AI Foundry endpoint URL | (required) |
| `aiModelDeployment` | Model deployment name | `gpt-4o` |
| `systemPrompt` | System prompt for the AI assistant | Logic Apps expert prompt |

### App Settings (for deployed Logic App)

| Setting | Description |
|---------|-------------|
| `MCP_SERVER_URL` | URL of the MCP server (without /api/mcp path) |
| `AI_FOUNDRY_ENDPOINT` | Azure OpenAI endpoint URL |
| `AI_FOUNDRY_DEPLOYMENT` | Model deployment name (e.g., gpt-4o) |
| `AI_FOUNDRY_API_KEY` | API key for Azure OpenAI |

```bash
# Set app settings
az logicapp config appsettings set \
  --name la-lamcp-agent \
  --resource-group rg-logicapps-mcp \
  --settings \
    "MCP_SERVER_URL=https://la-lamcp-mcp.azurewebsites.net" \
    "AI_FOUNDRY_ENDPOINT=https://<your-openai>.openai.azure.com" \
    "AI_FOUNDRY_DEPLOYMENT=gpt-4o" \
    "AI_FOUNDRY_API_KEY=<your-api-key>"
```

## Deployment

### Deploy to Azure

```bash
# Navigate to agent-loop folder
cd agent-loop

# Deploy workflows to Logic App Standard
az logicapp deployment source config-zip \
  --name la-lamcp-agent \
  --resource-group lamcp-rg \
  --src agent-loop.zip
```

### Test Locally

```bash
# Start the Logic App locally (requires Azurite for storage)
func start
```

## API Usage

### Request

```http
POST /api/logic-apps-assistant/triggers/When_a_HTTP_request_is_received/invoke
Content-Type: application/json

{
  "message": "Why is my order-processor Logic App failing?",
  "conversationId": "optional-id-for-multi-turn"
}
```

### Response

```json
{
  "response": "I found the issue! The Parse_JSON action is failing because...",
  "iterations": 3,
  "conversationHistory": [
    { "role": "system", "content": "You are a helpful Azure Logic Apps assistant..." },
    { "role": "user", "content": "Why is my order-processor Logic App failing?" },
    { "role": "assistant", "content": null, "tool_calls": [...] },
    { "role": "tool", "tool_call_id": "call_123", "content": "..." },
    { "role": "assistant", "content": "I found the issue..." }
  ]
}
```

## Workflow Structure

```
logic-apps-assistant/
  workflow.json     # Workflow definition
```

### Actions

1. **Initialize_conversation** - Set up messages array with system prompt and user message
2. **Get_MCP_tools** - Call MCP server's `tools/list` to get available tools
3. **Convert_to_OpenAI_tools** - Transform MCP tool format to OpenAI function format
4. **Agent_loop** - Until loop that:
   - Calls AI model with messages and tools
   - Executes any tool calls via MCP server
   - Continues until no more tool calls
5. **Response** - Return final AI response

## Security

- **MCP Server Authentication**: Currently unauthenticated (for testing)
- **AI Foundry Authentication**: Uses Managed Identity
- **Incoming Requests**: Configure Easy Auth to restrict callers

## Next Steps

1. Configure AI Foundry endpoint in parameters
2. Add Easy Auth to both Logic App and Function App
3. Set up conversation history storage for multi-turn
4. Add error handling and retry logic
