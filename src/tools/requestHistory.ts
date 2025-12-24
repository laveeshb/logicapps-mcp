/**
 * Action request history tools for debugging HTTP connector calls.
 */

import {
  armRequest,
  armRequestAllPages,
  workflowMgmtRequest,
} from "../utils/http.js";
import { McpError } from "../utils/errors.js";
import { detectLogicAppSku, getStandardAppAccess } from "./shared.js";

// Request history entry from Azure API
interface RequestHistoryEntry {
  id: string;
  name: string;
  type: string;
  properties: {
    startTime: string;
    endTime?: string;
    request?: {
      method: string;
      uri: string;
      headers?: Record<string, string>;
    };
    response?: {
      statusCode: number;
      headers?: Record<string, string>;
      bodyLink?: {
        uri: string;
        contentSize: number;
      };
    };
    error?: {
      code: string;
      message: string;
    };
  };
}

// Consumer-facing result type
export interface GetActionRequestHistoryResult {
  actionName: string;
  requestHistories: Array<{
    name: string;
    startTime: string;
    endTime?: string;
    request?: {
      method: string;
      uri: string;
      headers?: Record<string, string>;
    };
    response?: {
      statusCode: number;
      headers?: Record<string, string>;
      bodyContentSize?: number;
    };
    error?: {
      code: string;
      message: string;
    };
  }>;
}

/**
 * Get HTTP request/response details for connector actions.
 * Shows the actual HTTP calls made to external services.
 */
export async function getActionRequestHistory(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  actionName: string,
  workflowName?: string,
  requestHistoryName?: string
): Promise<GetActionRequestHistoryResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    return getRequestHistoryConsumption(
      subscriptionId,
      resourceGroupName,
      logicAppName,
      runId,
      actionName,
      requestHistoryName
    );
  }

  // Standard requires workflowName
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps"
    );
  }

  return getRequestHistoryStandard(
    subscriptionId,
    resourceGroupName,
    logicAppName,
    workflowName,
    runId,
    actionName,
    requestHistoryName
  );
}

async function getRequestHistoryConsumption(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  actionName: string,
  requestHistoryName?: string
): Promise<GetActionRequestHistoryResult> {
  const basePath = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/runs/${runId}/actions/${actionName}/requestHistories`;

  if (requestHistoryName) {
    const entry = await armRequest<RequestHistoryEntry>(
      `${basePath}/${requestHistoryName}`,
      { queryParams: { "api-version": "2019-05-01" } }
    );

    return {
      actionName,
      requestHistories: [mapRequestHistory(entry)],
    };
  }

  const entries = await armRequestAllPages<RequestHistoryEntry>(basePath, {
    "api-version": "2019-05-01",
  });

  return {
    actionName,
    requestHistories: entries.map(mapRequestHistory),
  };
}

async function getRequestHistoryStandard(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName: string,
  runId: string,
  actionName: string,
  requestHistoryName?: string
): Promise<GetActionRequestHistoryResult> {
  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  const basePath = `/runtime/webhooks/workflow/api/management/workflows/${workflowName}/runs/${runId}/actions/${actionName}/requestHistories`;

  if (requestHistoryName) {
    const entry = await workflowMgmtRequest<RequestHistoryEntry>(
      hostname,
      `${basePath}/${requestHistoryName}?api-version=2020-05-01-preview`,
      masterKey
    );

    return {
      actionName,
      requestHistories: [mapRequestHistory(entry)],
    };
  }

  const response = await workflowMgmtRequest<{
    value?: RequestHistoryEntry[];
  }>(hostname, `${basePath}?api-version=2020-05-01-preview`, masterKey);

  const entries = response.value ?? [];

  return {
    actionName,
    requestHistories: entries.map(mapRequestHistory),
  };
}

function mapRequestHistory(entry: RequestHistoryEntry) {
  return {
    name: entry.name,
    startTime: entry.properties.startTime,
    endTime: entry.properties.endTime,
    request: entry.properties.request
      ? {
          method: entry.properties.request.method,
          uri: entry.properties.request.uri,
          headers: entry.properties.request.headers,
        }
      : undefined,
    response: entry.properties.response
      ? {
          statusCode: entry.properties.response.statusCode,
          headers: entry.properties.response.headers,
          bodyContentSize: entry.properties.response.bodyLink?.contentSize,
        }
      : undefined,
    error: entry.properties.error,
  };
}
