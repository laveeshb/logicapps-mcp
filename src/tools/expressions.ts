/**
 * Expression evaluation traces for debugging workflow expressions.
 */

import { armRequest, workflowMgmtRequest } from "../utils/http.js";
import { McpError } from "../utils/errors.js";
import { detectLogicAppSku, getStandardAppAccess } from "./shared.js";

// Expression trace from Azure API
interface ExpressionTraceEntry {
  text?: string;
  value?: unknown;
  error?: {
    message: string;
  };
}

// Consumer-facing result type
export interface GetExpressionTracesResult {
  actionName: string;
  traces: Array<{
    expression: string;
    value?: unknown;
    error?: string;
  }>;
}

/**
 * Get expression evaluation traces for an action.
 * Shows how workflow expressions were evaluated at runtime.
 */
export async function getExpressionTraces(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  actionName: string,
  workflowName?: string
): Promise<GetExpressionTracesResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    return getExpressionTracesConsumption(
      subscriptionId,
      resourceGroupName,
      logicAppName,
      runId,
      actionName
    );
  }

  // Standard requires workflowName
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps"
    );
  }

  return getExpressionTracesStandard(
    subscriptionId,
    resourceGroupName,
    logicAppName,
    workflowName,
    runId,
    actionName
  );
}

async function getExpressionTracesConsumption(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  actionName: string
): Promise<GetExpressionTracesResult> {
  const response = await armRequest<{ inputs?: ExpressionTraceEntry[] }>(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/runs/${runId}/actions/${actionName}/listExpressionTraces`,
    { method: "POST", queryParams: { "api-version": "2019-05-01" } }
  );

  const traces = response.inputs ?? [];

  return {
    actionName,
    traces: traces.map((t) => ({
      expression: t.text ?? "",
      value: t.value,
      error: t.error?.message,
    })),
  };
}

async function getExpressionTracesStandard(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName: string,
  runId: string,
  actionName: string
): Promise<GetExpressionTracesResult> {
  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  // Standard uses workflow management API
  const response = await workflowMgmtRequest<{ inputs?: ExpressionTraceEntry[] }>(
    hostname,
    `/runtime/webhooks/workflow/api/management/workflows/${workflowName}/runs/${runId}/actions/${actionName}/listExpressionTraces?api-version=2020-05-01-preview`,
    masterKey
  );

  const traces = response.inputs ?? [];

  return {
    actionName,
    traces: traces.map((t) => ({
      expression: t.text ?? "",
      value: t.value,
      error: t.error?.message,
    })),
  };
}
