/**
 * Shared utilities used across multiple tool implementations.
 */

import { armRequest } from "../utils/http.js";
import { McpError } from "../utils/errors.js";

/**
 * Extract resource group name from ARM resource ID.
 */
export function extractResourceGroup(resourceId: string): string {
  const match = resourceId.match(/\/resourceGroups\/([^/]+)/i);
  return match ? match[1] : "";
}

/**
 * Detect if Logic App is Consumption or Standard SKU.
 * Tries Consumption first, then Standard.
 */
export async function detectLogicAppSku(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string
): Promise<"consumption" | "standard"> {
  // Try Consumption first (Microsoft.Logic/workflows)
  try {
    await armRequest(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}`,
      { queryParams: { "api-version": "2019-05-01" } }
    );
    return "consumption";
  } catch (error) {
    if (error instanceof McpError && error.code === "ResourceNotFound") {
      // Not Consumption, try Standard
    } else {
      throw error;
    }
  }

  // Try Standard (Microsoft.Web/sites)
  try {
    const site = await armRequest<{ kind?: string }>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}`,
      { queryParams: { "api-version": "2023-01-01" } }
    );

    if (site.kind?.toLowerCase().includes("workflowapp")) {
      return "standard";
    }
  } catch {
    // Not found
  }

  throw new McpError(
    "ResourceNotFound",
    `Logic App '${logicAppName}' not found in resource group '${resourceGroupName}'`
  );
}

/**
 * Get Standard Logic App hostname and master key for Workflow Management API.
 */
export async function getStandardAppAccess(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string
): Promise<{ hostname: string; masterKey: string }> {
  // Get site details
  const site = await armRequest<{ properties: { defaultHostName: string } }>(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}`,
    { queryParams: { "api-version": "2023-01-01" } }
  );

  // Get master key
  const keys = await armRequest<{ masterKey: string }>(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}/host/default/listkeys`,
    { method: "POST", queryParams: { "api-version": "2023-01-01" } }
  );

  return {
    hostname: site.properties.defaultHostName,
    masterKey: keys.masterKey,
  };
}

/**
 * Generate Azure Portal URL for a Consumption Logic App run.
 */
export function getConsumptionRunPortalUrl(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runId: string,
  location: string
): string {
  const workflowId = encodeURIComponent(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}`
  );
  const fullRunId = encodeURIComponent(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/runs/${runId}`
  );
  return `https://portal.azure.com/#view/Microsoft_Azure_EMA/DesignerEditorConsumption.ReactView/id/${workflowId}/location/${location}/isReadOnly~/true/isMonitoringView~/true/runId/${fullRunId}`;
}

/**
 * Generate Azure Portal URL for a Standard Logic App run.
 */
export function getStandardRunPortalUrl(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName: string,
  runId: string
): string {
  const workflowId = encodeURIComponent(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}/workflows/${workflowName}`
  );
  const fullRunId = encodeURIComponent(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}/workflows/${workflowName}/runs/${runId}`
  );
  return `https://portal.azure.com/#view/Microsoft_Azure_EMA/DesignerEditor.ReactView/id/${workflowId}/isReadOnly~/true/isMonitoringView~/true/runId/${fullRunId}`;
}
