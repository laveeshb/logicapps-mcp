/**
 * Copilot plugin endpoints for Logic Apps management.
 * All endpoints require bearer token - no anonymous access.
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

const ARM_ENDPOINT = "https://management.azure.com";

/**
 * Extract and validate bearer token from request.
 * Returns null if no token provided.
 */
function extractToken(request: HttpRequest): string | null {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  return token || null;
}

/**
 * Return 401 response for missing token.
 */
function unauthorizedResponse(): HttpResponseInit {
  return {
    status: 401,
    jsonBody: {
      error: "Authorization required",
      message: "Bearer token must be provided in Authorization header",
    },
  };
}

/**
 * Make authenticated ARM API call.
 */
async function armFetch<T>(token: string, path: string): Promise<T> {
  const url = `${ARM_ENDPOINT}${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ARM API error (${response.status}): ${error}`);
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// List Subscriptions
// ============================================================================

interface ArmSubscription {
  subscriptionId: string;
  displayName: string;
  state: string;
}

async function listSubscriptionsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = extractToken(request);
  if (!token) {
    context.warn("listSubscriptions: No bearer token");
    return unauthorizedResponse();
  }

  try {
    const data = await armFetch<{ value: ArmSubscription[] }>(
      token,
      "/subscriptions?api-version=2022-12-01"
    );

    const subscriptions = data.value.map((sub) => ({
      id: sub.subscriptionId,
      displayName: sub.displayName,
      state: sub.state,
    }));

    context.log(`listSubscriptions: Found ${subscriptions.length} subscriptions`);
    return {
      status: 200,
      jsonBody: { subscriptions },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    context.error(`listSubscriptions failed: ${errorMsg}`);
    return {
      status: 500,
      jsonBody: { error: errorMsg },
    };
  }
}

app.http("copilot-subscriptions", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "copilot/subscriptions",
  handler: listSubscriptionsHandler,
});

// ============================================================================
// List Logic Apps
// ============================================================================

interface ArmLogicApp {
  id: string;
  name: string;
  type: string;
  location: string;
  kind?: string;
  properties?: {
    state?: string;
  };
}

async function listLogicAppsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = extractToken(request);
  if (!token) {
    context.warn("listLogicApps: No bearer token");
    return unauthorizedResponse();
  }

  const subscriptionId = request.query.get("subscriptionId");
  if (!subscriptionId) {
    return {
      status: 400,
      jsonBody: { error: "subscriptionId query parameter is required" },
    };
  }

  try {
    // Get both Consumption and Standard Logic Apps
    const [consumption, standard] = await Promise.all([
      // Consumption Logic Apps
      armFetch<{ value: ArmLogicApp[] }>(
        token,
        `/subscriptions/${subscriptionId}/providers/Microsoft.Logic/workflows?api-version=2019-05-01`
      ).catch(() => ({ value: [] })),
      // Standard Logic Apps (workflow apps)
      armFetch<{ value: ArmLogicApp[] }>(
        token,
        `/subscriptions/${subscriptionId}/providers/Microsoft.Web/sites?api-version=2022-09-01`
      ).then((data) => ({
        value: data.value.filter((site) => site.kind?.includes("workflowapp")),
      })).catch(() => ({ value: [] })),
    ]);

    const logicApps = [
      ...consumption.value.map((app) => ({
        id: app.id,
        name: app.name,
        type: "Consumption",
        location: app.location,
        resourceGroup: app.id.split("/")[4],
        state: app.properties?.state || "Unknown",
      })),
      ...standard.value.map((app) => ({
        id: app.id,
        name: app.name,
        type: "Standard",
        location: app.location,
        resourceGroup: app.id.split("/")[4],
        state: app.properties?.state || "Unknown",
      })),
    ];

    context.log(`listLogicApps: Found ${logicApps.length} Logic Apps`);
    return {
      status: 200,
      jsonBody: { logicApps },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    context.error(`listLogicApps failed: ${errorMsg}`);
    return {
      status: 500,
      jsonBody: { error: errorMsg },
    };
  }
}

app.http("copilot-logic-apps", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "copilot/logic-apps",
  handler: listLogicAppsHandler,
});

// ============================================================================
// Get Failed Runs
// ============================================================================

interface ArmWorkflowRun {
  id: string;
  name: string;
  properties: {
    status: string;
    startTime: string;
    endTime?: string;
    error?: {
      code: string;
      message: string;
    };
  };
}

async function getFailedRunsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = extractToken(request);
  if (!token) {
    context.warn("getFailedRuns: No bearer token");
    return unauthorizedResponse();
  }

  const subscriptionId = request.query.get("subscriptionId");
  const resourceGroup = request.query.get("resourceGroup");
  const logicAppName = request.query.get("logicAppName");
  const workflowName = request.query.get("workflowName"); // For Standard Logic Apps
  const hours = parseInt(request.query.get("hours") || "24", 10);

  if (!subscriptionId || !resourceGroup || !logicAppName) {
    return {
      status: 400,
      jsonBody: {
        error: "Required parameters: subscriptionId, resourceGroup, logicAppName",
      },
    };
  }

  try {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const filter = `status eq 'Failed' and startTime ge ${startTime}`;

    let runsPath: string;
    if (workflowName) {
      // Standard Logic App workflow
      runsPath = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Web/sites/${logicAppName}/hostruntime/runtime/webhooks/workflow/api/management/workflows/${workflowName}/runs?api-version=2018-11-01&$filter=${encodeURIComponent(filter)}`;
    } else {
      // Consumption Logic App
      runsPath = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Logic/workflows/${logicAppName}/runs?api-version=2019-05-01&$filter=${encodeURIComponent(filter)}`;
    }

    const data = await armFetch<{ value: ArmWorkflowRun[] }>(token, runsPath);

    const failedRuns = data.value.map((run) => ({
      id: run.id,
      name: run.name,
      status: run.properties.status,
      startTime: run.properties.startTime,
      endTime: run.properties.endTime,
      error: run.properties.error,
    }));

    context.log(`getFailedRuns: Found ${failedRuns.length} failed runs`);
    return {
      status: 200,
      jsonBody: { failedRuns },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    context.error(`getFailedRuns failed: ${errorMsg}`);
    return {
      status: 500,
      jsonBody: { error: errorMsg },
    };
  }
}

app.http("copilot-failed-runs", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "copilot/failed-runs",
  handler: getFailedRunsHandler,
});

export {
  listSubscriptionsHandler,
  listLogicAppsHandler,
  getFailedRunsHandler,
};
