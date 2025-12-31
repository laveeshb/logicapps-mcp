/**
 * Action and scope repetition tools for debugging loops and conditional branches.
 */

import { armRequest, armRequestAllPages, workflowMgmtRequest } from "../utils/http.js";
import { McpError } from "../utils/errors.js";
import { detectLogicAppSku, getStandardAppAccess } from "./shared.js";

// Action repetition from Azure API (for ForEach, Until loops)
interface ActionRepetitionEntry {
  id: string;
  name: string;
  type: string;
  properties: {
    status: "Succeeded" | "Failed" | "Skipped" | "Running";
    startTime: string;
    endTime?: string;
    iterationCount?: number;
    inputsLink?: { uri: string };
    outputsLink?: { uri: string };
    error?: {
      code: string;
      message: string;
    };
    trackedProperties?: Record<string, unknown>;
  };
}

// Scope repetition from Azure API (for Scope, Switch, Condition)
interface ScopeRepetitionEntry {
  id: string;
  name: string;
  type: string;
  properties: {
    status: "Succeeded" | "Failed" | "Skipped";
    startTime: string;
    endTime?: string;
    error?: {
      code: string;
      message: string;
    };
  };
}

// Consumer-facing result types
export interface GetActionRepetitionsResult {
  actionName: string;
  repetitions: Array<{
    name: string;
    status: "Succeeded" | "Failed" | "Skipped" | "Running";
    startTime: string;
    endTime?: string;
    iterationCount?: number;
    hasInputs: boolean;
    hasOutputs: boolean;
    error?: {
      code: string;
      message: string;
    };
    trackedProperties?: Record<string, unknown>;
  }>;
}

export interface GetScopeRepetitionsResult {
  actionName: string;
  scopeRepetitions: Array<{
    name: string;
    status: "Succeeded" | "Failed" | "Skipped";
    startTime: string;
    endTime?: string;
    error?: {
      code: string;
      message: string;
    };
  }>;
}

/**
 * Get action repetitions for loop iterations (ForEach, Until).
 * Shows individual iteration status, inputs, and outputs.
 */
export async function getActionRepetitions(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  actionName: string,
  workflowName?: string,
  repetitionName?: string
): Promise<GetActionRepetitionsResult> {
  const sku = await detectLogicAppSku(subscriptionId, resourceGroupName, logicAppName);

  if (sku === "consumption") {
    return getActionRepetitionsConsumption(
      subscriptionId,
      resourceGroupName,
      logicAppName,
      runId,
      actionName,
      repetitionName
    );
  }

  // Standard requires workflowName
  if (!workflowName) {
    throw new McpError("InvalidParameter", "workflowName is required for Standard Logic Apps");
  }

  return getActionRepetitionsStandard(
    subscriptionId,
    resourceGroupName,
    logicAppName,
    workflowName,
    runId,
    actionName,
    repetitionName
  );
}

async function getActionRepetitionsConsumption(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  actionName: string,
  repetitionName?: string
): Promise<GetActionRepetitionsResult> {
  const basePath = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/runs/${runId}/actions/${actionName}/repetitions`;

  if (repetitionName) {
    const repetition = await armRequest<ActionRepetitionEntry>(`${basePath}/${repetitionName}`, {
      queryParams: { "api-version": "2019-05-01" },
    });

    return {
      actionName,
      repetitions: [
        {
          name: repetition.name,
          status: repetition.properties.status,
          startTime: repetition.properties.startTime,
          endTime: repetition.properties.endTime,
          iterationCount: repetition.properties.iterationCount,
          hasInputs: !!repetition.properties.inputsLink,
          hasOutputs: !!repetition.properties.outputsLink,
          error: repetition.properties.error,
          trackedProperties: repetition.properties.trackedProperties,
        },
      ],
    };
  }

  const repetitions = await armRequestAllPages<ActionRepetitionEntry>(basePath, {
    "api-version": "2019-05-01",
  });

  return {
    actionName,
    repetitions: repetitions.map((r) => ({
      name: r.name,
      status: r.properties.status,
      startTime: r.properties.startTime,
      endTime: r.properties.endTime,
      iterationCount: r.properties.iterationCount,
      hasInputs: !!r.properties.inputsLink,
      hasOutputs: !!r.properties.outputsLink,
      error: r.properties.error,
      trackedProperties: r.properties.trackedProperties,
    })),
  };
}

async function getActionRepetitionsStandard(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName: string,
  runId: string,
  actionName: string,
  repetitionName?: string
): Promise<GetActionRepetitionsResult> {
  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  const basePath = `/runtime/webhooks/workflow/api/management/workflows/${workflowName}/runs/${runId}/actions/${actionName}/repetitions`;

  if (repetitionName) {
    const repetition = await workflowMgmtRequest<ActionRepetitionEntry>(
      hostname,
      `${basePath}/${repetitionName}?api-version=2020-05-01-preview`,
      masterKey
    );

    return {
      actionName,
      repetitions: [
        {
          name: repetition.name,
          status: repetition.properties.status,
          startTime: repetition.properties.startTime,
          endTime: repetition.properties.endTime,
          iterationCount: repetition.properties.iterationCount,
          hasInputs: !!repetition.properties.inputsLink,
          hasOutputs: !!repetition.properties.outputsLink,
          error: repetition.properties.error,
          trackedProperties: repetition.properties.trackedProperties,
        },
      ],
    };
  }

  const response = await workflowMgmtRequest<{
    value?: ActionRepetitionEntry[];
  }>(hostname, `${basePath}?api-version=2020-05-01-preview`, masterKey);

  const repetitions = response.value ?? [];

  return {
    actionName,
    repetitions: repetitions.map((r) => ({
      name: r.name,
      status: r.properties.status,
      startTime: r.properties.startTime,
      endTime: r.properties.endTime,
      iterationCount: r.properties.iterationCount,
      hasInputs: !!r.properties.inputsLink,
      hasOutputs: !!r.properties.outputsLink,
      error: r.properties.error,
      trackedProperties: r.properties.trackedProperties,
    })),
  };
}

/**
 * Get scope repetitions for conditional branches (Scope, Switch, Condition).
 * Shows which branch executed and its status.
 */
export async function getScopeRepetitions(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  actionName: string,
  workflowName?: string
): Promise<GetScopeRepetitionsResult> {
  const sku = await detectLogicAppSku(subscriptionId, resourceGroupName, logicAppName);

  if (sku === "consumption") {
    return getScopeRepetitionsConsumption(
      subscriptionId,
      resourceGroupName,
      logicAppName,
      runId,
      actionName
    );
  }

  // Standard requires workflowName
  if (!workflowName) {
    throw new McpError("InvalidParameter", "workflowName is required for Standard Logic Apps");
  }

  return getScopeRepetitionsStandard(
    subscriptionId,
    resourceGroupName,
    logicAppName,
    workflowName,
    runId,
    actionName
  );
}

async function getScopeRepetitionsConsumption(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  actionName: string
): Promise<GetScopeRepetitionsResult> {
  const basePath = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/runs/${runId}/actions/${actionName}/scopeRepetitions`;

  const repetitions = await armRequestAllPages<ScopeRepetitionEntry>(basePath, {
    "api-version": "2019-05-01",
  });

  return {
    actionName,
    scopeRepetitions: repetitions.map((r) => ({
      name: r.name,
      status: r.properties.status,
      startTime: r.properties.startTime,
      endTime: r.properties.endTime,
      error: r.properties.error,
    })),
  };
}

async function getScopeRepetitionsStandard(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName: string,
  runId: string,
  actionName: string
): Promise<GetScopeRepetitionsResult> {
  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  const basePath = `/runtime/webhooks/workflow/api/management/workflows/${workflowName}/runs/${runId}/actions/${actionName}/scopeRepetitions`;

  const response = await workflowMgmtRequest<{
    value?: ScopeRepetitionEntry[];
  }>(hostname, `${basePath}?api-version=2020-05-01-preview`, masterKey);

  const repetitions = response.value ?? [];

  return {
    actionName,
    scopeRepetitions: repetitions.map((r) => ({
      name: r.name,
      status: r.properties.status,
      startTime: r.properties.startTime,
      endTime: r.properties.endTime,
      error: r.properties.error,
    })),
  };
}
