/**
 * Trigger-related tools for Logic Apps.
 */

import {
  armRequest,
  armRequestAllPages,
  workflowMgmtRequest,
} from "../utils/http.js";
import { McpError } from "../utils/errors.js";
import { detectLogicAppSku, getStandardAppAccess } from "./shared.js";

// Trigger history entry from Azure API
interface TriggerHistoryEntry {
  id: string;
  name: string;
  type: string;
  properties: {
    status: "Succeeded" | "Failed" | "Skipped";
    startTime: string;
    endTime?: string;
    code?: string;
    fired: boolean;
    run?: {
      name: string;
      id: string;
    };
    error?: {
      code: string;
      message: string;
    };
  };
}

// Consumer-facing result type
export interface GetTriggerHistoryResult {
  triggerName: string;
  histories: Array<{
    name: string;
    status: "Succeeded" | "Failed" | "Skipped";
    startTime: string;
    endTime?: string;
    code?: string;
    fired: boolean;
    runId?: string;
    error?: {
      code: string;
      message: string;
    };
  }>;
}

/**
 * Get trigger execution history for a workflow trigger.
 * Shows when the trigger fired, succeeded, or failed.
 */
export async function getTriggerHistory(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  triggerName: string,
  workflowName?: string,
  top?: number,
  filter?: string
): Promise<GetTriggerHistoryResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  const effectiveTop = Math.min(top ?? 25, 100);

  if (sku === "consumption") {
    return getTriggerHistoryConsumption(
      subscriptionId,
      resourceGroupName,
      logicAppName,
      triggerName,
      effectiveTop,
      filter
    );
  }

  // Standard requires workflowName
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps"
    );
  }

  return getTriggerHistoryStandard(
    subscriptionId,
    resourceGroupName,
    logicAppName,
    workflowName,
    triggerName,
    effectiveTop,
    filter
  );
}

async function getTriggerHistoryConsumption(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  triggerName: string,
  top: number,
  filter?: string
): Promise<GetTriggerHistoryResult> {
  const queryParams: Record<string, string> = {
    "api-version": "2019-05-01",
    $top: top.toString(),
  };
  if (filter) {
    queryParams["$filter"] = filter;
  }

  const histories = await armRequestAllPages<TriggerHistoryEntry>(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/triggers/${triggerName}/histories`,
    queryParams
  );

  return {
    triggerName,
    histories: histories.slice(0, top).map((h) => ({
      name: h.name,
      status: h.properties.status,
      startTime: h.properties.startTime,
      endTime: h.properties.endTime,
      code: h.properties.code,
      fired: h.properties.fired,
      runId: h.properties.run?.name,
      error: h.properties.error,
    })),
  };
}

async function getTriggerHistoryStandard(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName: string,
  triggerName: string,
  top: number,
  filter?: string
): Promise<GetTriggerHistoryResult> {
  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  let path = `/runtime/webhooks/workflow/api/management/workflows/${workflowName}/triggers/${triggerName}/histories?api-version=2020-05-01-preview&$top=${top}`;
  if (filter) {
    path += `&$filter=${encodeURIComponent(filter)}`;
  }

  const response = await workflowMgmtRequest<{
    value?: TriggerHistoryEntry[];
  }>(hostname, path, masterKey);

  const histories = response.value ?? [];

  return {
    triggerName,
    histories: histories.map((h) => ({
      name: h.name,
      status: h.properties.status,
      startTime: h.properties.startTime,
      endTime: h.properties.endTime,
      code: h.properties.code,
      fired: h.properties.fired,
      runId: h.properties.run?.name,
      error: h.properties.error,
    })),
  };
}

// Callback URL response from Azure API
interface CallbackUrlResponse {
  value: string;
  method: string;
  basePath: string;
  queries?: Record<string, string>;
  relativePath?: string;
  relativePathParameters?: string[];
}

// Consumer-facing result type
export interface GetTriggerCallbackUrlResult {
  triggerName: string;
  callbackUrl: string;
  method: string;
  basePath: string;
  queries?: Record<string, string>;
}

/**
 * Get the callback URL for request-based triggers (HTTP, manual).
 * This is the URL that must be called to invoke the workflow.
 */
export async function getTriggerCallbackUrl(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  triggerName: string,
  workflowName?: string
): Promise<GetTriggerCallbackUrlResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    return getCallbackUrlConsumption(
      subscriptionId,
      resourceGroupName,
      logicAppName,
      triggerName
    );
  }

  // Standard requires workflowName
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps"
    );
  }

  return getCallbackUrlStandard(
    subscriptionId,
    resourceGroupName,
    logicAppName,
    workflowName,
    triggerName
  );
}

async function getCallbackUrlConsumption(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  triggerName: string
): Promise<GetTriggerCallbackUrlResult> {
  const response = await armRequest<CallbackUrlResponse>(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/triggers/${triggerName}/listCallbackUrl`,
    { method: "POST", queryParams: { "api-version": "2019-05-01" } }
  );

  return {
    triggerName,
    callbackUrl: response.value,
    method: response.method,
    basePath: response.basePath,
    queries: response.queries,
  };
}

async function getCallbackUrlStandard(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName: string,
  triggerName: string
): Promise<GetTriggerCallbackUrlResult> {
  // For Standard, use ARM API with hostruntime path
  const response = await armRequest<CallbackUrlResponse>(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}/hostruntime/runtime/webhooks/workflow/api/management/workflows/${workflowName}/triggers/${triggerName}/listCallbackUrl`,
    { method: "POST", queryParams: { "api-version": "2022-03-01" } }
  );

  return {
    triggerName,
    callbackUrl: response.value,
    method: response.method,
    basePath: response.basePath,
    queries: response.queries,
  };
}

// ============================================================================
// Write Operations
// ============================================================================

export interface RunTriggerResult {
  success: boolean;
  triggerName: string;
  message: string;
}

/**
 * Manually run a workflow trigger.
 * This starts a new workflow run by firing the specified trigger.
 */
export async function runTrigger(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  triggerName: string,
  workflowName?: string
): Promise<RunTriggerResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    await armRequest(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/triggers/${triggerName}/run`,
      { method: "POST", queryParams: { "api-version": "2019-05-01" } }
    );

    return {
      success: true,
      triggerName,
      message: `Trigger '${triggerName}' has been fired for Consumption workflow '${logicAppName}'. Check run history for the new run.`,
    };
  }

  // Standard requires workflowName
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps"
    );
  }

  // For Standard, use the ARM API with hostruntime path
  await armRequest(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}/hostruntime/runtime/webhooks/workflow/api/management/workflows/${workflowName}/triggers/${triggerName}/run`,
    { method: "POST", queryParams: { "api-version": "2022-03-01" } }
  );

  return {
    success: true,
    triggerName,
    message: `Trigger '${triggerName}' has been fired for Standard workflow '${workflowName}' in '${logicAppName}'. Check run history for the new run.`,
  };
}
