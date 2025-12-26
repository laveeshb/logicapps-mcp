/**
 * Routes tool calls to appropriate implementation functions.
 * Handles parameter validation and error wrapping.
 */

import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
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
} from "./workflows.js";
import { getTriggerHistory, getTriggerCallbackUrl } from "./triggers.js";
import { listRunHistory, getRunDetails, getRunActions, getActionIO, searchRuns } from "./runs.js";
import { getActionRepetitions, getScopeRepetitions } from "./repetitions.js";
import { getActionRequestHistory } from "./requestHistory.js";
import { getExpressionTraces } from "./expressions.js";
import { getWorkflowSwagger } from "./swagger.js";
import { getConnections, getConnectionDetails, testConnection } from "./connections.js";
import { getHostStatus } from "./host.js";
import { McpError, formatError } from "../utils/errors.js";

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    let result: unknown;

    switch (name) {
      case "list_subscriptions":
        result = await listSubscriptions();
        break;
      case "list_logic_apps":
        result = await listLogicApps(
          args.subscriptionId as string,
          args.resourceGroupName as string | undefined,
          args.sku as "consumption" | "standard" | "all" | undefined
        );
        break;
      case "list_workflows":
        result = await listWorkflows(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string
        );
        break;
      case "get_workflow_definition":
        result = await getWorkflowDefinition(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.workflowName as string | undefined
        );
        break;
      case "get_workflow_triggers":
        result = await getWorkflowTriggers(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.workflowName as string | undefined
        );
        break;
      case "list_run_history":
        result = await listRunHistory(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.workflowName as string | undefined,
          args.top as number | undefined,
          args.filter as string | undefined
        );
        break;
      case "get_run_details":
        result = await getRunDetails(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.runId as string,
          args.workflowName as string | undefined
        );
        break;
      case "get_run_actions":
        result = await getRunActions(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.runId as string,
          args.workflowName as string | undefined,
          args.actionName as string | undefined
        );
        break;
      case "get_connections":
        result = await getConnections(
          args.subscriptionId as string,
          args.resourceGroupName as string
        );
        break;
      case "get_host_status":
        result = await getHostStatus(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string
        );
        break;
      case "list_workflow_versions":
        result = await listWorkflowVersions(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.top as number | undefined
        );
        break;
      case "get_trigger_history":
        result = await getTriggerHistory(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.triggerName as string,
          args.workflowName as string | undefined,
          args.top as number | undefined,
          args.filter as string | undefined
        );
        break;
      case "get_action_repetitions":
        result = await getActionRepetitions(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.runId as string,
          args.actionName as string,
          args.workflowName as string | undefined,
          args.repetitionName as string | undefined
        );
        break;
      case "get_action_request_history":
        result = await getActionRequestHistory(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.runId as string,
          args.actionName as string,
          args.workflowName as string | undefined,
          args.requestHistoryName as string | undefined
        );
        break;
      case "get_trigger_callback_url":
        result = await getTriggerCallbackUrl(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.triggerName as string,
          args.workflowName as string | undefined
        );
        break;
      case "get_scope_repetitions":
        result = await getScopeRepetitions(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.runId as string,
          args.actionName as string,
          args.workflowName as string | undefined
        );
        break;
      case "get_expression_traces":
        result = await getExpressionTraces(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.runId as string,
          args.actionName as string,
          args.workflowName as string | undefined
        );
        break;
      case "get_workflow_swagger":
        result = await getWorkflowSwagger(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.workflowName as string | undefined
        );
        break;
      case "get_action_io":
        result = await getActionIO(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.runId as string,
          args.actionName as string,
          args.workflowName as string | undefined,
          args.type as "inputs" | "outputs" | "both" | undefined
        );
        break;
      case "search_runs":
        result = await searchRuns(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.workflowName as string | undefined,
          args.status as "Succeeded" | "Failed" | "Cancelled" | "Running" | undefined,
          args.startTime as string | undefined,
          args.endTime as string | undefined,
          args.clientTrackingId as string | undefined,
          args.top as number | undefined
        );
        break;
      case "get_workflow_version":
        result = await getWorkflowVersion(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.versionId as string
        );
        break;
      case "get_connection_details":
        result = await getConnectionDetails(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.connectionName as string
        );
        break;
      case "test_connection":
        result = await testConnection(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.connectionName as string
        );
        break;
      // Write Operations
      case "enable_workflow":
        result = await enableWorkflow(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.workflowName as string | undefined
        );
        break;
      case "disable_workflow":
        result = await disableWorkflow(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.workflowName as string | undefined
        );
        break;
      default:
        throw new McpError("InvalidTool", `Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: JSON.stringify(formatError(error)) }],
      isError: true,
    };
  }
}
