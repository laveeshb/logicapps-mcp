/**
 * MCP Tool definitions with JSON Schema for parameters.
 * These are returned by ListToolsRequest.
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const TOOL_DEFINITIONS: Tool[] = [
  {
    name: "list_subscriptions",
    description:
      "List all Azure subscriptions accessible to the authenticated user. Use this first to discover available subscriptions, then use list_logic_apps to find Logic Apps.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "list_logic_apps",
    description:
      "List all Logic Apps in a subscription or resource group. Returns both Consumption and Standard SKUs. Consumption Logic Apps have a single workflow; Standard Logic Apps can have multiple workflows (use list_workflows to see them).",
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
      "List workflows within a Logic App. Standard SKU can have multiple workflows; Consumption SKU returns a single workflow with the same name as the Logic App. Use this to discover workflow names before calling other workflow-specific tools.",
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
      "Get the full workflow definition JSON for a Logic App workflow. For Consumption SKU, omit workflowName. For Standard SKU, workflowName is required. Use update_workflow to modify the definition.",
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
      "Get trigger information for a workflow including last/next execution times. For Standard SKU, workflowName is required. Use run_trigger to manually fire a trigger, or get_trigger_history to see past executions.",
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
    description: "Get the run history for a workflow with optional filtering. For Standard SKU, workflowName is required. Use search_runs for easier filtering by status/date. After finding a run, use get_run_details and get_run_actions to debug.",
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
    description: "Get detailed information about a specific workflow run including status, timing, and error summary. For Standard SKU, workflowName is required. Use get_run_actions to see which specific action failed.",
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
    description: "Get the action execution details for a specific workflow run including status, timing, and trackedProperties. For Standard SKU, workflowName is required. Use get_action_io to see actual inputs/outputs for an action.",
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
    description: "List API connections (e.g., Office 365, SQL, Service Bus) in a resource group. Connections are shared resources used by Logic Apps for authentication. Use get_connection_details or test_connection for more info.",
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
      "Get iteration details for actions inside loops (ForEach, Until). Each iteration is a 'repetition' with its own status, inputs, outputs, and trackedProperties. For Standard SKU, workflowName is required. Essential for debugging loop failures.",
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
      "Get HTTP request/response details for connector actions including retries. Shows actual HTTP calls made to external services with headers, status codes, and timing. For Standard SKU, workflowName is required. Useful for debugging API failures.",
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
      "Get the callback URL for request-based triggers (HTTP, manual). Returns the URL with SAS token for invoking the workflow. For Standard SKU, workflowName is required. Use run_trigger to test the workflow instead of calling the URL directly.",
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
      "Get execution details for scope action iterations (Scope, Switch, Condition). Shows which branch executed, status, and trackedProperties. For Standard SKU, workflowName is required.",
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
      "Get expression evaluation traces for an action. Shows how workflow expressions (e.g., @body(), @variables()) were evaluated at runtime, including the expression text, result value, and any errors. For Standard SKU, workflowName is required. Essential for debugging expression failures.",
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
      "Get the OpenAPI/Swagger definition for a workflow. Shows trigger schemas and request/response formats. For Standard SKU, workflowName is required. Useful for API documentation or generating client SDKs.",
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
    name: "get_action_io",
    description:
      "Get the actual input/output data for a run action. Fetches content from inputsLink/outputsLink URLs. For Standard SKU, workflowName is required. Essential for debugging data transformation issues.",
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
        runId: {
          type: "string",
          description: "Run ID",
        },
        actionName: {
          type: "string",
          description: "Action name",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
        type: {
          type: "string",
          enum: ["inputs", "outputs", "both"],
          description: "Which content to fetch (default: both)",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName", "runId", "actionName"],
    },
  },
  {
    name: "search_runs",
    description:
      "Search run history with friendly parameters (status, startTime, endTime, clientTrackingId) instead of raw OData filter syntax. For Standard SKU, workflowName is required. Use this instead of list_run_history when filtering by specific criteria.",
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
        status: {
          type: "string",
          enum: ["Succeeded", "Failed", "Cancelled", "Running"],
          description: "Filter by run status",
        },
        startTime: {
          type: "string",
          description: "Filter runs starting after this ISO timestamp (e.g., 2025-12-24T00:00:00Z)",
        },
        endTime: {
          type: "string",
          description: "Filter runs starting before this ISO timestamp",
        },
        clientTrackingId: {
          type: "string",
          description: "Filter by correlation/tracking ID",
        },
        top: {
          type: "number",
          description: "Number of runs to return (default: 25, max: 100)",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName"],
    },
  },
  {
    name: "get_workflow_version",
    description:
      "Get a specific historical version's definition. Only available for Consumption Logic Apps. Use list_workflow_versions to see available versions.",
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
        versionId: {
          type: "string",
          description: "Version ID (from list_workflow_versions)",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName", "versionId"],
    },
  },
  {
    name: "get_connection_details",
    description:
      "Get detailed information about a specific API connection including authentication status, configuration, and API reference. Use test_connection to verify the connection is working.",
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
        connectionName: {
          type: "string",
          description: "API connection name",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "connectionName"],
    },
  },
  {
    name: "test_connection",
    description:
      "Test if an API connection is valid and working. Checks connection status and validates authentication. Use this to diagnose connector failures in workflow runs.",
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
        connectionName: {
          type: "string",
          description: "API connection name",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "connectionName"],
    },
  },
  // ============================================================================
  // Write Operations
  // ============================================================================
  {
    name: "enable_workflow",
    description:
      "Enable a disabled workflow, allowing it to process triggers and run. For Consumption Logic Apps, enables the entire Logic App. For Standard Logic Apps, enables a specific workflow within the Logic App.",
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
    name: "disable_workflow",
    description:
      "Disable an active workflow, stopping it from processing triggers and running. In-progress runs will continue until completion. For Consumption Logic Apps, disables the entire Logic App. For Standard Logic Apps, disables a specific workflow within the Logic App.",
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
    name: "run_trigger",
    description:
      "Manually fire a workflow trigger to start a new run immediately, bypassing any schedule or event condition. For Standard SKU, workflowName is required. Use get_workflow_triggers first to find available trigger names. Then use list_run_history to see the result.",
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
        triggerName: {
          type: "string",
          description: "The name of the trigger to run (e.g., 'manual', 'When_a_HTTP_request_is_received')",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName", "triggerName"],
    },
  },
  {
    name: "cancel_run",
    description:
      "Cancel a running or waiting workflow run. Only runs in 'Running' or 'Waiting' status can be cancelled. For Standard SKU, workflowName is required. Use list_run_history or search_runs to find running runs first.",
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
        runId: {
          type: "string",
          description: "The run ID to cancel",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName", "runId"],
    },
  },
  {
    name: "create_workflow",
    description:
      "Create a new workflow. For Consumption SKU, creates a new Logic App resource. For Standard SKU, creates a new workflow within an existing Logic App. Requires a valid workflow definition JSON that follows the Logic Apps schema.",
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
          description: "Logic App resource name (for Consumption, this becomes the new Logic App name)",
        },
        definition: {
          type: "object",
          description: "The workflow definition JSON following the Logic Apps schema",
        },
        location: {
          type: "string",
          description: "Azure region (required for Consumption SKU, e.g., 'westus2', 'eastus')",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
        kind: {
          type: "string",
          enum: ["Stateful", "Stateless"],
          description: "Workflow kind for Standard SKU (default: 'Stateful')",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName", "definition"],
    },
  },
  {
    name: "update_workflow",
    description:
      "Update an existing workflow's definition. Replaces the entire definition with the new one. For Standard SKU, workflowName is required. Use get_workflow_definition first to get the current definition, modify it, then update.",
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
        definition: {
          type: "object",
          description: "The new workflow definition JSON following the Logic Apps schema",
        },
        workflowName: {
          type: "string",
          description: "Workflow name (required for Standard SKU)",
        },
        kind: {
          type: "string",
          enum: ["Stateful", "Stateless"],
          description: "Workflow kind for Standard SKU (default: 'Stateful')",
        },
      },
      required: ["subscriptionId", "resourceGroupName", "logicAppName", "definition"],
    },
  },
  {
    name: "delete_workflow",
    description:
      "Delete a workflow. For Consumption SKU, deletes the entire Logic App resource. For Standard SKU, deletes a specific workflow within the Logic App. Use with caution as this action cannot be undone.",
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
