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
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
} from "./workflows.js";
import { getTriggerHistory, getTriggerCallbackUrl, runTrigger } from "./triggers.js";
import { listRunHistory, getRunDetails, getRunActions, getActionIO, searchRuns, cancelRun } from "./runs.js";
import { getActionRepetitions, getScopeRepetitions } from "./repetitions.js";
import { getActionRequestHistory } from "./requestHistory.js";
import { getExpressionTraces } from "./expressions.js";
import { getWorkflowSwagger } from "./swagger.js";
import { getConnections, getConnectionDetails, testConnection, getConnectorSwagger, invokeConnectorOperation, createConnection } from "./connections.js";
import { getHostStatus } from "./host.js";
import { getTroubleshootingGuide, getAuthoringGuide, getReference } from "./knowledge.js";
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
          args.filter as string | undefined,
          args.skipToken as string | undefined
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
      case "create_connection":
        result = await createConnection(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.connectionName as string,
          args.connectorName as string,
          args.location as string,
          args.displayName as string | undefined,
          args.parameterValues as Record<string, unknown> | undefined
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
          args.top as number | undefined,
          args.skipToken as string | undefined
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
      case "get_connector_swagger":
        result = await getConnectorSwagger(
          args.subscriptionId as string,
          args.location as string,
          args.connectorName as string
        );
        break;
      case "invoke_connector_operation":
        result = await invokeConnectorOperation(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.connectionName as string,
          args.operationId as string,
          args.parameters as Record<string, unknown> | undefined
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
      case "run_trigger":
        result = await runTrigger(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.triggerName as string,
          args.workflowName as string | undefined
        );
        break;
      case "cancel_run":
        result = await cancelRun(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.runId as string,
          args.workflowName as string | undefined
        );
        break;
      case "create_workflow":
        result = await createWorkflow(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.definition as import("../types/logicApp.js").WorkflowDefinition,
          args.location as string | undefined,
          args.workflowName as string | undefined,
          args.kind as string | undefined,
          args.connections as Record<string, { connectionName: string; id: string }> | undefined
        );
        break;
      case "update_workflow":
        result = await updateWorkflow(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.definition as import("../types/logicApp.js").WorkflowDefinition,
          args.workflowName as string | undefined,
          args.kind as string | undefined,
          args.connections as Record<string, { connectionName: string; id: string }> | undefined
        );
        break;
      case "delete_workflow":
        result = await deleteWorkflow(
          args.subscriptionId as string,
          args.resourceGroupName as string,
          args.logicAppName as string,
          args.workflowName as string | undefined
        );
        break;
      // Knowledge tools
      case "get_troubleshooting_guide":
        result = getTroubleshootingGuide(
          args.topic as "expression-errors" | "connection-issues" | "run-failures" | "known-limitations"
        );
        break;
      case "get_authoring_guide":
        result = getAuthoringGuide(
          args.topic as "workflow-patterns" | "connector-patterns" | "deployment"
        );
        break;
      case "get_reference":
        result = getReference(
          args.topic as "tool-catalog" | "sku-differences"
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
