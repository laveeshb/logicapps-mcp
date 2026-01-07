/**
 * Routes tool calls to appropriate implementation functions.
 * Handles parameter validation and error wrapping.
 */

import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { listSubscriptions } from "./subscriptions.js";
import { listLogicApps } from "./logicApps.js";
import {
  listWorkflows,
  getWorkflowDefinition,
  getWorkflowTriggers,
  listWorkflowVersions,
  getWorkflowVersion,
  enableWorkflow,
  disableWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  cloneWorkflow,
  validateCloneWorkflow,
} from "./workflows.js";
import { getTriggerHistory, getTriggerCallbackUrl, runTrigger } from "./triggers.js";
import {
  listRunHistory,
  getRunDetails,
  getRunActions,
  getActionIO,
  searchRuns,
  cancelRun,
} from "./runs.js";
import { getActionRepetitions, getScopeRepetitions } from "./repetitions.js";
import { getActionRequestHistory } from "./requestHistory.js";
import { getExpressionTraces } from "./expressions.js";
import { getWorkflowSwagger } from "./swagger.js";
import {
  getConnections,
  getConnectionDetails,
  testConnection,
  getConnectorSwagger,
  invokeConnectorOperation,
  createConnection,
} from "./connections.js";
import { getHostStatus } from "./host.js";
import {
  getTroubleshootingGuide,
  getAuthoringGuide,
  getReference,
  getWorkflowInstructions,
} from "./knowledge.js";
import { McpError, formatError } from "../utils/errors.js";
import { TOOL_SCHEMAS } from "./schemas.js";

/**
 * Format a ZodError into a user-friendly error response.
 */
function formatZodError(error: ZodError): { code: string; message: string; details: Array<{ path: string; message: string }> } {
  return {
    code: "InvalidParameter",
    message: "Invalid parameters",
    details: error.issues.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    })),
  };
}

/**
 * Validate tool arguments against the schema.
 * Returns the validated arguments or throws a formatted error.
 */
function validateArgs<T>(toolName: string, args: Record<string, unknown>): T {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) {
    throw new McpError("InvalidTool", `No schema defined for tool: ${toolName}`);
  }
  return schema.parse(args) as T;
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    let result: unknown;

    switch (name) {
      case "list_subscriptions":
        validateArgs(name, args);
        result = await listSubscriptions();
        break;
      case "list_logic_apps": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName?: string; sku?: "consumption" | "standard" | "all" }>(name, args);
        result = await listLogicApps(v.subscriptionId, v.resourceGroupName, v.sku);
        break;
      }
      case "list_workflows": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string }>(name, args);
        result = await listWorkflows(v.subscriptionId, v.resourceGroupName, v.logicAppName);
        break;
      }
      case "get_workflow_definition": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; workflowName?: string }>(name, args);
        result = await getWorkflowDefinition(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.workflowName);
        break;
      }
      case "get_workflow_triggers": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; workflowName?: string }>(name, args);
        result = await getWorkflowTriggers(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.workflowName);
        break;
      }
      case "list_run_history": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; workflowName?: string; top?: number; filter?: string; skipToken?: string }>(name, args);
        result = await listRunHistory(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.workflowName, v.top, v.filter, v.skipToken);
        break;
      }
      case "get_run_details": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; runId: string; workflowName?: string }>(name, args);
        result = await getRunDetails(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.runId, v.workflowName);
        break;
      }
      case "get_run_actions": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; runId: string; workflowName?: string; actionName?: string }>(name, args);
        result = await getRunActions(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.runId, v.workflowName, v.actionName);
        break;
      }
      case "get_connections": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string }>(name, args);
        result = await getConnections(v.subscriptionId, v.resourceGroupName);
        break;
      }
      case "create_connection": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; connectionName: string; connectorName: string; location: string; displayName?: string; parameterValues?: Record<string, unknown> }>(name, args);
        result = await createConnection(v.subscriptionId, v.resourceGroupName, v.connectionName, v.connectorName, v.location, v.displayName, v.parameterValues);
        break;
      }
      case "get_host_status": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string }>(name, args);
        result = await getHostStatus(v.subscriptionId, v.resourceGroupName, v.logicAppName);
        break;
      }
      case "list_workflow_versions": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; top?: number }>(name, args);
        result = await listWorkflowVersions(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.top);
        break;
      }
      case "get_trigger_history": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; triggerName: string; workflowName?: string; top?: number; filter?: string }>(name, args);
        result = await getTriggerHistory(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.triggerName, v.workflowName, v.top, v.filter);
        break;
      }
      case "get_action_repetitions": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; runId: string; actionName: string; workflowName?: string; repetitionName?: string }>(name, args);
        result = await getActionRepetitions(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.runId, v.actionName, v.workflowName, v.repetitionName);
        break;
      }
      case "get_action_request_history": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; runId: string; actionName: string; workflowName?: string; requestHistoryName?: string }>(name, args);
        result = await getActionRequestHistory(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.runId, v.actionName, v.workflowName, v.requestHistoryName);
        break;
      }
      case "get_trigger_callback_url": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; triggerName: string; workflowName?: string }>(name, args);
        result = await getTriggerCallbackUrl(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.triggerName, v.workflowName);
        break;
      }
      case "get_scope_repetitions": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; runId: string; actionName: string; workflowName?: string }>(name, args);
        result = await getScopeRepetitions(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.runId, v.actionName, v.workflowName);
        break;
      }
      case "get_expression_traces": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; runId: string; actionName: string; workflowName?: string }>(name, args);
        result = await getExpressionTraces(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.runId, v.actionName, v.workflowName);
        break;
      }
      case "get_workflow_swagger": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; workflowName?: string }>(name, args);
        result = await getWorkflowSwagger(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.workflowName);
        break;
      }
      case "get_action_io": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; runId: string; actionName: string; workflowName?: string; type?: "inputs" | "outputs" | "both" }>(name, args);
        result = await getActionIO(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.runId, v.actionName, v.workflowName, v.type);
        break;
      }
      case "search_runs": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; workflowName?: string; status?: "Succeeded" | "Failed" | "Cancelled" | "Running"; startTime?: string; endTime?: string; clientTrackingId?: string; top?: number; skipToken?: string }>(name, args);
        result = await searchRuns(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.workflowName, v.status, v.startTime, v.endTime, v.clientTrackingId, v.top, v.skipToken);
        break;
      }
      case "get_workflow_version": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; versionId: string }>(name, args);
        result = await getWorkflowVersion(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.versionId);
        break;
      }
      case "get_connection_details": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; connectionName: string }>(name, args);
        result = await getConnectionDetails(v.subscriptionId, v.resourceGroupName, v.connectionName);
        break;
      }
      case "test_connection": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; connectionName: string }>(name, args);
        result = await testConnection(v.subscriptionId, v.resourceGroupName, v.connectionName);
        break;
      }
      case "get_connector_swagger": {
        const v = validateArgs<{ subscriptionId: string; location: string; connectorName: string }>(name, args);
        result = await getConnectorSwagger(v.subscriptionId, v.location, v.connectorName);
        break;
      }
      case "invoke_connector_operation": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; connectionName: string; operationId: string; parameters?: Record<string, unknown> }>(name, args);
        result = await invokeConnectorOperation(v.subscriptionId, v.resourceGroupName, v.connectionName, v.operationId, v.parameters);
        break;
      }
      // Write Operations
      case "enable_workflow": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; workflowName?: string }>(name, args);
        result = await enableWorkflow(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.workflowName);
        break;
      }
      case "disable_workflow": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; workflowName?: string }>(name, args);
        result = await disableWorkflow(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.workflowName);
        break;
      }
      case "run_trigger": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; triggerName: string; workflowName?: string }>(name, args);
        result = await runTrigger(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.triggerName, v.workflowName);
        break;
      }
      case "cancel_run": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; runId: string; workflowName?: string }>(name, args);
        result = await cancelRun(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.runId, v.workflowName);
        break;
      }
      case "create_workflow": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; definition: import("../types/logicApp.js").WorkflowDefinition; location?: string; workflowName?: string; kind?: string; connections?: Record<string, { connectionName: string; id: string }> }>(name, args);
        result = await createWorkflow(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.definition, v.location, v.workflowName, v.kind, v.connections);
        break;
      }
      case "update_workflow": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; definition: import("../types/logicApp.js").WorkflowDefinition; workflowName?: string; kind?: string; connections?: Record<string, { connectionName: string; id: string }> }>(name, args);
        result = await updateWorkflow(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.definition, v.workflowName, v.kind, v.connections);
        break;
      }
      case "delete_workflow": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; workflowName?: string }>(name, args);
        result = await deleteWorkflow(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.workflowName);
        break;
      }
      case "clone_workflow": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; targetResourceGroupName: string; targetLogicAppName: string; targetWorkflowName: string; targetSubscriptionId?: string; targetKind?: string }>(name, args);
        result = await cloneWorkflow(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.targetResourceGroupName, v.targetLogicAppName, v.targetWorkflowName, v.targetSubscriptionId, v.targetKind);
        break;
      }
      case "validate_clone_workflow": {
        const v = validateArgs<{ subscriptionId: string; resourceGroupName: string; logicAppName: string; targetResourceGroupName: string; targetLogicAppName: string; targetWorkflowName: string; targetSubscriptionId?: string; targetKind?: string }>(name, args);
        result = await validateCloneWorkflow(v.subscriptionId, v.resourceGroupName, v.logicAppName, v.targetResourceGroupName, v.targetLogicAppName, v.targetWorkflowName, v.targetSubscriptionId, v.targetKind);
        break;
      }
      // Knowledge tools
      case "get_troubleshooting_guide": {
        const v = validateArgs<{ topic: "expression-errors" | "connection-issues" | "run-failures" | "known-limitations" }>(name, args);
        result = getTroubleshootingGuide(v.topic);
        break;
      }
      case "get_authoring_guide": {
        const v = validateArgs<{ topic: "workflow-patterns" | "connector-patterns" | "deployment" }>(name, args);
        result = getAuthoringGuide(v.topic);
        break;
      }
      case "get_reference": {
        const v = validateArgs<{ topic: "tool-catalog" | "sku-differences" }>(name, args);
        result = getReference(v.topic);
        break;
      }
      case "get_workflow_instructions": {
        const v = validateArgs<{ topic: "diagnose-failures" | "explain-workflow" | "monitor-workflows" | "create-workflow" | "fix-workflow" }>(name, args);
        result = getWorkflowInstructions(v.topic);
        break;
      }
      default:
        throw new McpError("InvalidTool", `Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    // Handle validation errors with detailed field-level messages
    if (error instanceof ZodError) {
      return {
        content: [{ type: "text", text: JSON.stringify(formatZodError(error)) }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(formatError(error)) }],
      isError: true,
    };
  }
}
