/**
 * Registers all MCP tools with the server.
 * Each tool is imported from its respective module and registered here.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS } from "./tools/definitions.js";
import { handleToolCall } from "./tools/handler.js";

const LOGIC_APPS_GUIDE = `# Azure Logic Apps MCP Server Guide

## SKU Types
Logic Apps come in two SKUs with different APIs:

### Consumption (Serverless)
- Single workflow per Logic App resource
- Use \`logicAppName\` parameter directly (no workflowName needed)
- Billed per execution

### Standard (App Service-based)
- Multiple workflows per Logic App
- Always specify \`workflowName\` parameter
- Stateful and Stateless workflow types

## Common Workflows

### 1. Debug a Failed Run
\`\`\`
list_run_history → find the failed run
get_run_details → see error summary  
get_run_actions → find which action failed
get_action_io → see actual inputs/outputs
get_expression_traces → debug expression failures
\`\`\`

### 2. Update a Workflow
\`\`\`
get_workflow_definition → get current definition
(modify the definition)
update_workflow → deploy changes
\`\`\`

### 3. Test Changes
\`\`\`
update_workflow → deploy
run_trigger → execute manually
list_run_history → check result
\`\`\`

### 4. Investigate Loop Iterations
\`\`\`
get_run_actions → find the foreach/until action
get_action_repetitions → see each iteration's status
get_action_io with repetitionName → get specific iteration data
\`\`\`

## Tool Selection Tips

| Need | Tool |
|------|------|
| Find runs by date/status | \`search_runs\` |
| Get all runs | \`list_run_history\` |
| See action inputs/outputs | \`get_action_io\` |
| Debug foreach loops | \`get_action_repetitions\` |
| Debug scope blocks | \`get_scope_repetitions\` |
| Check HTTP retries | \`get_action_request_history\` |
| View expression evaluation | \`get_expression_traces\` |
| Check tracked properties | \`get_run_actions\` (includes trackedProperties) |

## Parameters
- \`subscriptionId\`, \`resourceGroupName\`, \`logicAppName\` are always required
- \`workflowName\` is required for Standard SKU only
- Use \`list_subscriptions\` and \`list_logic_apps\` to discover resources
`;

export function registerTools(server: Server): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleToolCall(request.params.name, request.params.arguments ?? {});
  });

  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      {
        name: "logic-apps-guide",
        description: "System guidance for Azure Logic Apps operations - helps with tool selection and common workflows",
      },
    ],
  }));

  // Get prompt content
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name === "logic-apps-guide") {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: LOGIC_APPS_GUIDE,
            },
          },
        ],
      };
    }
    throw new Error(`Unknown prompt: ${request.params.name}`);
  });
}
