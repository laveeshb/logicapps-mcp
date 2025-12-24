/**
 * MCP Tool definitions with JSON Schema for parameters.
 * These are returned by ListToolsRequest.
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const TOOL_DEFINITIONS: Tool[] = [
  {
    name: "list_subscriptions",
    description:
      "List all Azure subscriptions accessible to the authenticated user",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "list_logic_apps",
    description:
      "List all Logic Apps (Consumption and Standard) in a subscription or resource group",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Filter by resource group (optional)",
        },
        sku: {
          type: "string",
          enum: ["consumption", "standard", "all"],
          description: "Filter by SKU type (default: all)",
        },
      },
      required: ["subscriptionId"],
    },
  },
  {
    name: "list_workflows",
    description:
      "List workflows within a Standard Logic App (Standard SKU can have multiple workflows)",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName"],
    },
  },
  {
    name: "get_workflow_definition",
    description:
      "Get the full workflow definition (JSON) for a Logic App workflow",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
        workflowName: {
          type: "string",
          description:
            "Workflow name (required for Standard SKU, omit for Consumption)",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName"],
    },
  },
  {
    name: "get_workflow_triggers",
    description:
      "Get trigger information for a workflow including last/next execution times",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName"],
    },
  },
  {
    name: "list_run_history",
    description: "Get the run history for a workflow with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
        top: {
          type: "number",
          description: "Number of runs to return (default: 25, max: 100)",
        },
        filter: {
          type: "string",
          description: "OData filter (e.g., \"status eq 'Failed'\")",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName"],
    },
  },
  {
    name: "get_run_details",
    description: "Get detailed information about a specific workflow run",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
        runId: {
          type: "string",
          description: "The run ID to retrieve",
        },
      },
      required: [
        "subscriptionId",
        "resourceGroupName",
        "logicAppName",
        "runId",
      ],
    },
  },
  {
    name: "get_run_actions",
    description: "Get the action execution details for a specific workflow run",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
        runId: {
          type: "string",
          description: "The run ID",
        },
        actionName: {
          type: "string",
          description: "Filter to a specific action (optional)",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName", "runId"],
    },
  },
  {
    name: "get_connections",
    description: "List API connections used by Logic Apps in a resource group",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
      },
      required: ["subscriptionId", "resourceGroupName"],
    },
  },
  {
    name: "get_host_status",
    description:
      "Get host status for a Standard Logic App including runtime version, extension bundle version, and diagnostics. Only available for Standard SKU.",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName"],
    },
  },
  {
    name: "list_workflow_versions",
    description:
      "List all versions of a Consumption Logic App workflow with creation and change times. Only available for Consumption SKU.",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
        top: {
          type: "number",
          description: "Number of versions to return (optional)",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName"],
    },
  },
  {
    name: "get_trigger_history",
    description:
      "Get the execution history of a specific trigger, showing when it fired, succeeded, or failed. Essential for debugging why a workflow didn't run when expected.",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
        triggerName: {
          type: "string",
          description: "Trigger name to get history for",
        },
        top: {
          type: "number",
          description: "Number of history entries to return (default: 25, max: 100)",
        },
        filter: {
          type: "string",
          description: "OData filter (e.g., \"status eq 'Failed'\")",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName", "triggerName"],
    },
  },
  {
    name: "get_action_repetitions",
    description:
      "Get iteration details for actions inside loops (ForEach, Until). Each iteration is a 'repetition' with its own status, inputs, and outputs.",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
        runId: {
          type: "string",
          description: "Run ID",
        },
        actionName: {
          type: "string",
          description: "Action name (the loop action)",
        },
        repetitionName: {
          type: "string",
          description: "Specific repetition to get (e.g., '000000', '000001')",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName", "runId", "actionName"],
    },
  },
  {
    name: "get_action_request_history",
    description:
      "Get HTTP request/response details for connector actions. Shows the actual HTTP calls made to external services including headers, body size, and response codes.",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
        runId: {
          type: "string",
          description: "Run ID",
        },
        actionName: {
          type: "string",
          description: "Action name (HTTP, connector actions)",
        },
        requestHistoryName: {
          type: "string",
          description: "Specific request history entry name",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName", "runId", "actionName"],
    },
  },
  {
    name: "get_trigger_callback_url",
    description:
      "Get the callback URL for request-based triggers (HTTP, manual). This is the URL that must be called to invoke the workflow. Contains SAS token for authentication.",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
        triggerName: {
          type: "string",
          description: "Trigger name",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName", "triggerName"],
    },
  },
  {
    name: "get_scope_repetitions",
    description:
      "Get execution details for scope action iterations (Scope, Switch, Condition). Shows which branch executed and its status.",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
        runId: {
          type: "string",
          description: "Run ID",
        },
        actionName: {
          type: "string",
          description: "Scope action name",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName", "runId", "actionName"],
    },
  },
  {
    name: "get_expression_traces",
    description:
      "Get expression evaluation traces for an action. Shows how workflow expressions were evaluated at runtime, including the expression text, result value, and any errors.",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
        runId: {
          type: "string",
          description: "Run ID",
        },
        actionName: {
          type: "string",
          description: "Action name",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName", "runId", "actionName"],
    },
  },
  {
    name: "get_workflow_swagger",
    description:
      "Get the OpenAPI/Swagger definition for a workflow. Shows available triggers and their schemas for API documentation and client SDK generation.",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Azure subscription ID",
        },
        resourceGroupName: {
          type: "string",
          description: "Resource group name",
        },
        logicAppName: {
          type: "string",
          description: "Logic App resource name",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName"],
    },
  },
];
