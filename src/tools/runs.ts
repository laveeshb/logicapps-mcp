/**
 * Workflow run history operations for both SKUs.
 */

import {
  armRequest,
  armRequestAllPages,
  workflowMgmtRequest,
} from "../utils/http.js";
import { WorkflowRun, RunAction } from "../types/logicApp.js";
import { McpError } from "../utils/errors.js";
import { detectLogicAppSku, getStandardAppAccess } from "./shared.js";

export interface ListRunHistoryResult {
  runs: Array<{
    id: string;
    name: string;
    status: string;
    startTime: string;
    endTime?: string;
    trigger: {
      name: string;
    };
    correlation?: {
      clientTrackingId: string;
    };
  }>;
}

export interface GetRunDetailsResult {
  run: {
    id: string;
    name: string;
    status: string;
    startTime: string;
    endTime?: string;
    trigger: {
      name: string;
    };
    error?: {
      code: string;
      message: string;
    };
  };
}

export interface GetRunActionsResult {
  actions: Array<{
    name: string;
    type: string;
    status: string;
    startTime: string;
    endTime?: string;
    error?: {
      code: string;
      message: string;
    };
  }>;
}

export async function listRunHistory(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName?: string,
  top: number = 25,
  filter?: string
): Promise<ListRunHistoryResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );
  const effectiveTop = Math.min(top, 100);

  if (sku === "consumption") {
    const queryParams: Record<string, string> = {
      "api-version": "2019-05-01",
      $top: effectiveTop.toString(),
    };
    if (filter) queryParams["$filter"] = filter;

    const runs = await armRequestAllPages<WorkflowRun>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/runs`,
      queryParams
    );

    return {
      runs: runs.slice(0, effectiveTop).map((run) => ({
        id: run.id,
        name: run.name,
        status: run.properties.status,
        startTime: run.properties.startTime,
        endTime: run.properties.endTime,
        trigger: { name: run.properties.trigger?.name ?? "unknown" },
        correlation: run.properties.correlation,
      })),
    };
  }

  // Standard - use Workflow Management API
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps"
    );
  }

  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  let path = `/runtime/webhooks/workflow/api/management/workflows/${workflowName}/runs?api-version=2020-05-01-preview&$top=${effectiveTop}`;
  if (filter) path += `&$filter=${encodeURIComponent(filter)}`;

  const response = await workflowMgmtRequest<{ value?: WorkflowRun[] }>(
    hostname,
    path,
    masterKey
  );

  const runsList = response.value ?? [];

  return {
    runs: runsList.map((run) => ({
      id: run.id,
      name: run.name,
      status: run.properties.status,
      startTime: run.properties.startTime,
      endTime: run.properties.endTime,
      trigger: { name: run.properties.trigger?.name ?? "unknown" },
      correlation: run.properties.correlation,
    })),
  };
}

export async function getRunDetails(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  workflowName?: string
): Promise<GetRunDetailsResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    const run = await armRequest<WorkflowRun>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/runs/${runId}`,
      { queryParams: { "api-version": "2019-05-01" } }
    );

    return {
      run: {
        id: run.id,
        name: run.name,
        status: run.properties.status,
        startTime: run.properties.startTime,
        endTime: run.properties.endTime,
        trigger: { name: run.properties.trigger?.name ?? "unknown" },
        error: run.properties.error,
      },
    };
  }

  // Standard
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps"
    );
  }

  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );
  const run = await workflowMgmtRequest<WorkflowRun>(
    hostname,
    `/runtime/webhooks/workflow/api/management/workflows/${workflowName}/runs/${runId}?api-version=2020-05-01-preview`,
    masterKey
  );

  return {
    run: {
      id: run.id,
      name: run.name,
      status: run.properties.status,
      startTime: run.properties.startTime,
      endTime: run.properties.endTime,
      trigger: { name: run.properties.trigger?.name ?? "unknown" },
      error: run.properties.error,
    },
  };
}

export async function getRunActions(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  workflowName?: string,
  actionName?: string
): Promise<GetRunActionsResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    return getRunActionsConsumption(
      subscriptionId,
      resourceGroupName,
      logicAppName,
      runId,
      actionName
    );
  }

  // Standard
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps"
    );
  }

  return getRunActionsStandard(
    subscriptionId,
    resourceGroupName,
    logicAppName,
    workflowName,
    runId,
    actionName
  );
}

async function getRunActionsConsumption(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  actionName?: string
): Promise<GetRunActionsResult> {
  const basePath = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/runs/${runId}/actions`;

  if (actionName) {
    const action = await armRequest<RunAction>(`${basePath}/${actionName}`, {
      queryParams: { "api-version": "2019-05-01" },
    });

    return {
      actions: [
        {
          name: action.name,
          type: action.type,
          status: action.properties.status,
          startTime: action.properties.startTime,
          endTime: action.properties.endTime,
          error: action.properties.error,
        },
      ],
    };
  }

  const actions = await armRequestAllPages<RunAction>(basePath, {
    "api-version": "2019-05-01",
  });

  return {
    actions: actions.map((action) => ({
      name: action.name,
      type: action.type,
      status: action.properties.status,
      startTime: action.properties.startTime,
      endTime: action.properties.endTime,
      error: action.properties.error,
    })),
  };
}

async function getRunActionsStandard(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName: string,
  runId: string,
  actionName?: string
): Promise<GetRunActionsResult> {
  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );
  const basePath = `/runtime/webhooks/workflow/api/management/workflows/${workflowName}/runs/${runId}/actions`;

  if (actionName) {
    const action = await workflowMgmtRequest<RunAction>(
      hostname,
      `${basePath}/${actionName}?api-version=2020-05-01-preview`,
      masterKey
    );

    return {
      actions: [
        {
          name: action.name,
          type: action.type,
          status: action.properties.status,
          startTime: action.properties.startTime,
          endTime: action.properties.endTime,
          error: action.properties.error,
        },
      ],
    };
  }

  const response = await workflowMgmtRequest<{ value?: RunAction[] }>(
    hostname,
    `${basePath}?api-version=2020-05-01-preview`,
    masterKey
  );

  const actionsList = response.value ?? [];

  return {
    actions: actionsList.map((action) => ({
      name: action.name,
      type: action.type,
      status: action.properties.status,
      startTime: action.properties.startTime,
      endTime: action.properties.endTime,
      error: action.properties.error,
    })),
  };
}
