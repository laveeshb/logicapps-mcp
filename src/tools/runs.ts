/**
 * Workflow run history operations for both SKUs.
 */

import {
  armRequest,
  armRequestVoid,
  armRequestAllPages,
  workflowMgmtRequest,
  workflowMgmtRequestAllPages,
} from "../utils/http.js";
import { WorkflowRun, RunAction, ConsumptionLogicApp } from "../types/logicApp.js";
import { McpError } from "../utils/errors.js";
import {
  detectLogicAppSku,
  getStandardAppAccess,
  getConsumptionRunPortalUrl,
  getStandardRunPortalUrl,
} from "./shared.js";

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
    portalUrl?: string;
  }>;
  nextLink?: string;
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
    portalUrl?: string;
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
    trackedProperties?: Record<string, unknown>;
  }>;
}

export async function listRunHistory(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName?: string,
  top: number = 25,
  filter?: string,
  skipToken?: string
): Promise<ListRunHistoryResult> {
  const sku = await detectLogicAppSku(subscriptionId, resourceGroupName, logicAppName);
  const effectiveTop = Math.min(top, 100);

  if (sku === "consumption") {
    // Get Logic App to retrieve location for portal URLs
    const logicApp = await armRequest<ConsumptionLogicApp>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}`,
      { queryParams: { "api-version": "2019-05-01" } }
    );
    const location = logicApp.location.toLowerCase().replace(/\s/g, "");

    const queryParams: Record<string, string> = {
      "api-version": "2019-05-01",
      $top: effectiveTop.toString(),
    };
    if (filter) queryParams["$filter"] = filter;
    if (skipToken) queryParams["$skiptoken"] = skipToken;

    const response = await armRequest<{ value: WorkflowRun[]; nextLink?: string }>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/runs`,
      { queryParams }
    );

    const runs = response.value ?? [];

    return {
      runs: runs.map((run) => ({
        id: run.id,
        name: run.name,
        status: run.properties.status,
        startTime: run.properties.startTime,
        endTime: run.properties.endTime,
        trigger: { name: run.properties.trigger?.name ?? "unknown" },
        correlation: run.properties.correlation,
        portalUrl: getConsumptionRunPortalUrl(
          subscriptionId,
          resourceGroupName,
          logicAppName,
          run.name,
          location
        ),
      })),
      nextLink: response.nextLink,
    };
  }

  // Standard - use Workflow Management API
  if (!workflowName) {
    throw new McpError("InvalidParameter", "workflowName is required for Standard Logic Apps");
  }

  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  let path = `/runtime/webhooks/workflow/api/management/workflows/${workflowName}/runs?api-version=2020-05-01-preview&$top=${effectiveTop}`;
  if (filter) path += `&$filter=${encodeURIComponent(filter)}`;
  if (skipToken) path += `&$skiptoken=${encodeURIComponent(skipToken)}`;

  const response = await workflowMgmtRequest<{ value?: WorkflowRun[]; nextLink?: string }>(
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
      portalUrl: getStandardRunPortalUrl(
        subscriptionId,
        resourceGroupName,
        logicAppName,
        workflowName,
        run.name
      ),
    })),
    nextLink: response.nextLink,
  };
}

export async function getRunDetails(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  workflowName?: string
): Promise<GetRunDetailsResult> {
  const sku = await detectLogicAppSku(subscriptionId, resourceGroupName, logicAppName);

  if (sku === "consumption") {
    // Fetch Logic App details to get location
    const logicApp = await armRequest<ConsumptionLogicApp>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}`,
      { queryParams: { "api-version": "2019-05-01" } }
    );
    const location = logicApp.location;

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
        portalUrl: getConsumptionRunPortalUrl(
          subscriptionId,
          resourceGroupName,
          logicAppName,
          run.name,
          location
        ),
      },
    };
  }

  // Standard
  if (!workflowName) {
    throw new McpError("InvalidParameter", "workflowName is required for Standard Logic Apps");
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
      portalUrl: getStandardRunPortalUrl(
        subscriptionId,
        resourceGroupName,
        logicAppName,
        workflowName,
        run.name
      ),
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
  const sku = await detectLogicAppSku(subscriptionId, resourceGroupName, logicAppName);

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
    throw new McpError("InvalidParameter", "workflowName is required for Standard Logic Apps");
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
          trackedProperties: action.properties.trackedProperties,
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
      trackedProperties: action.properties.trackedProperties,
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
          trackedProperties: action.properties.trackedProperties,
        },
      ],
    };
  }

  // Use paginated request to handle workflows with >100 actions
  const actionsList = await workflowMgmtRequestAllPages<RunAction>(
    hostname,
    `${basePath}?api-version=2020-05-01-preview`,
    masterKey
  );

  return {
    actions: actionsList.map((action) => ({
      name: action.name,
      type: action.type,
      status: action.properties.status,
      startTime: action.properties.startTime,
      endTime: action.properties.endTime,
      error: action.properties.error,
      trackedProperties: action.properties.trackedProperties,
    })),
  };
}

export interface GetActionIOResult {
  actionName: string;
  inputs?: unknown;
  outputs?: unknown;
}

/**
 * Get the actual input/output content for a run action.
 * Follows the inputsLink/outputsLink URLs to fetch the content.
 */
export async function getActionIO(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  actionName: string,
  workflowName?: string,
  type: "inputs" | "outputs" | "both" = "both"
): Promise<GetActionIOResult> {
  const sku = await detectLogicAppSku(subscriptionId, resourceGroupName, logicAppName);

  let action: RunAction;

  if (sku === "consumption") {
    action = await armRequest<RunAction>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/runs/${runId}/actions/${actionName}`,
      { queryParams: { "api-version": "2019-05-01" } }
    );
  } else {
    if (!workflowName) {
      throw new McpError("InvalidParameter", "workflowName is required for Standard Logic Apps");
    }

    const { hostname, masterKey } = await getStandardAppAccess(
      subscriptionId,
      resourceGroupName,
      logicAppName
    );
    action = await workflowMgmtRequest<RunAction>(
      hostname,
      `/runtime/webhooks/workflow/api/management/workflows/${workflowName}/runs/${runId}/actions/${actionName}?api-version=2020-05-01-preview`,
      masterKey
    );
  }

  const result: GetActionIOResult = { actionName };

  // Fetch inputs if requested
  if ((type === "inputs" || type === "both") && action.properties.inputsLink?.uri) {
    result.inputs = await fetchContentLink(action.properties.inputsLink.uri);
  }

  // Fetch outputs if requested
  if ((type === "outputs" || type === "both") && action.properties.outputsLink?.uri) {
    result.outputs = await fetchContentLink(action.properties.outputsLink.uri);
  }

  return result;
}

/**
 * Fetch content from an inputsLink/outputsLink URL.
 * These URLs include SAS tokens so no additional auth is needed.
 */
async function fetchContentLink(url: string): Promise<unknown> {
  const TIMEOUT_MS = 30000; // 30 second timeout
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new McpError(
        "ServiceError",
        `Failed to fetch content link: ${response.status} ${response.statusText}`
      );
    }

    // Check content length before reading body
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_SIZE_BYTES) {
      throw new McpError(
        "ServiceError",
        `Content too large (${Math.round(parseInt(contentLength, 10) / 1024 / 1024)}MB). Maximum size is 10MB.`
      );
    }

    const text = await response.text();

    // Check actual size (content-length may be missing)
    if (text.length > MAX_SIZE_BYTES) {
      throw new McpError(
        "ServiceError",
        `Content too large (${Math.round(text.length / 1024 / 1024)}MB). Maximum size is 10MB.`
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      // Return raw text if not valid JSON
      return text;
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new McpError("ServiceError", `Request timed out after ${TIMEOUT_MS / 1000} seconds`);
    }
    throw new McpError("ServiceError", `Failed to fetch content: ${error}`);
  } finally {
    clearTimeout(timeout);
  }
}

export interface SearchRunsResult {
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
  count: number;
  nextLink?: string;
}

/**
 * Search runs with friendly parameters instead of raw OData filter syntax.
 * Uses server-side filtering for performance.
 */
export async function searchRuns(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName?: string,
  status?: "Succeeded" | "Failed" | "Cancelled" | "Running",
  startTime?: string,
  endTime?: string,
  clientTrackingId?: string,
  top: number = 25,
  skipToken?: string
): Promise<SearchRunsResult> {
  // Build OData filter from friendly parameters
  const filterParts: string[] = [];

  if (status) {
    filterParts.push(`status eq '${status}'`);
  }
  if (startTime) {
    filterParts.push(`startTime ge ${startTime}`);
  }
  if (endTime) {
    filterParts.push(`startTime le ${endTime}`);
  }

  const filter = filterParts.length > 0 ? filterParts.join(" and ") : undefined;

  // If clientTrackingId is provided, we need to handle pagination specially
  // because the API doesn't support filtering by clientTrackingId server-side
  if (clientTrackingId) {
    // Fetch pages until we have enough matching results or run out of pages
    const matchingRuns: SearchRunsResult["runs"] = [];
    let currentSkipToken = skipToken;
    const maxIterations = 10; // Safety limit to prevent infinite loops
    let iterations = 0;

    while (matchingRuns.length < top && iterations < maxIterations) {
      iterations++;

      const pageResult = await listRunHistory(
        subscriptionId,
        resourceGroupName,
        logicAppName,
        workflowName,
        100, // Fetch max page size for efficiency
        filter,
        currentSkipToken
      );

      // Filter this page for matching clientTrackingId
      const matching = pageResult.runs.filter(
        (run) => run.correlation?.clientTrackingId === clientTrackingId
      );
      matchingRuns.push(...matching);

      // If no more pages, stop
      if (!pageResult.nextLink) {
        break;
      }

      // Extract skipToken from nextLink for next iteration
      const nextLinkUrl = new URL(pageResult.nextLink);
      currentSkipToken = nextLinkUrl.searchParams.get("$skiptoken") ?? undefined;
    }

    return {
      runs: matchingRuns.slice(0, top),
      count: Math.min(matchingRuns.length, top),
      // Cannot provide valid nextLink for client-side filtered results
      nextLink: undefined,
    };
  }

  // Standard case: use server-side filtering only
  const result = await listRunHistory(
    subscriptionId,
    resourceGroupName,
    logicAppName,
    workflowName,
    top,
    filter,
    skipToken
  );

  return {
    runs: result.runs,
    count: result.runs.length,
    nextLink: result.nextLink,
  };
}

// ============================================================================
// Write Operations
// ============================================================================

export interface CancelRunResult {
  success: boolean;
  runId: string;
  message: string;
}

/**
 * Cancel a running workflow run.
 * Only runs with status 'Running' or 'Waiting' can be cancelled.
 */
export async function cancelRun(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  workflowName?: string
): Promise<CancelRunResult> {
  const sku = await detectLogicAppSku(subscriptionId, resourceGroupName, logicAppName);

  if (sku === "consumption") {
    await armRequestVoid(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/runs/${runId}/cancel`,
      { method: "POST", queryParams: { "api-version": "2019-05-01" } }
    );

    return {
      success: true,
      runId,
      message: `Run '${runId}' has been cancelled for Consumption workflow '${logicAppName}'.`,
    };
  }

  // Standard requires workflowName
  if (!workflowName) {
    throw new McpError("InvalidParameter", "workflowName is required for Standard Logic Apps");
  }

  // For Standard, use the ARM API with hostruntime path
  await armRequestVoid(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}/hostruntime/runtime/webhooks/workflow/api/management/workflows/${workflowName}/runs/${runId}/cancel`,
    { method: "POST", queryParams: { "api-version": "2022-03-01" } }
  );

  return {
    success: true,
    runId,
    message: `Run '${runId}' has been cancelled for Standard workflow '${workflowName}' in '${logicAppName}'.`,
  };
}
