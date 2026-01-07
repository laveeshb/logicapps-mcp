/**
 * Shared utilities used across multiple tool implementations.
 */

import { armRequest } from "../utils/http.js";
import { McpError } from "../utils/errors.js";

// ============================================================================
// Cache Implementation
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// In-memory caches
const skuCache = new Map<string, CacheEntry<"consumption" | "standard">>();
const accessCache = new Map<string, CacheEntry<{ hostname: string; masterKey: string }>>();

// Default TTL: 5 minutes (matches LOGICAPPS_MCP_CACHE_TTL default)
let cacheTtlMs = 5 * 60 * 1000;

/**
 * Set the cache TTL in milliseconds.
 * Called during initialization from settings.
 */
export function setCacheTtl(ttlSeconds: number): void {
  cacheTtlMs = ttlSeconds * 1000;
}

/**
 * Generate cache key from resource identifiers (case-insensitive).
 */
function getCacheKey(subscriptionId: string, resourceGroupName: string, logicAppName: string): string {
  return `${subscriptionId}/${resourceGroupName}/${logicAppName}`.toLowerCase();
}

/**
 * Clear all caches or specific entries.
 * If no arguments provided, clears all caches.
 */
export function clearCache(
  subscriptionId?: string,
  resourceGroupName?: string,
  logicAppName?: string
): void {
  if (!subscriptionId) {
    skuCache.clear();
    accessCache.clear();
    return;
  }

  const prefix = logicAppName
    ? getCacheKey(subscriptionId, resourceGroupName!, logicAppName)
    : `${subscriptionId}/${resourceGroupName ?? ""}`.toLowerCase();

  for (const key of skuCache.keys()) {
    if (key.startsWith(prefix)) {
      skuCache.delete(key);
    }
  }
  for (const key of accessCache.keys()) {
    if (key.startsWith(prefix)) {
      accessCache.delete(key);
    }
  }
}

// ============================================================================
// Resource Utilities
// ============================================================================

/**
 * Extract resource group name from ARM resource ID.
 */
export function extractResourceGroup(resourceId: string): string {
  const match = resourceId.match(/\/resourceGroups\/([^/]+)/i);
  return match ? match[1] : "";
}

/**
 * Detect if Logic App is Consumption or Standard SKU.
 * Results are cached to reduce API calls.
 */
export async function detectLogicAppSku(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string
): Promise<"consumption" | "standard"> {
  const cacheKey = getCacheKey(subscriptionId, resourceGroupName, logicAppName);

  // Check cache first
  const cached = skuCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // Detect SKU from API
  const sku = await detectSkuFromApi(subscriptionId, resourceGroupName, logicAppName);

  // Cache the result
  skuCache.set(cacheKey, {
    value: sku,
    expiresAt: Date.now() + cacheTtlMs,
  });

  return sku;
}

/**
 * Internal: Detect SKU by calling Azure APIs.
 */
async function detectSkuFromApi(
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
  } catch (error) {
    // Only ignore ResourceNotFound, propagate auth/network errors
    if (!(error instanceof McpError && error.code === "ResourceNotFound")) {
      throw error;
    }
  }

  throw new McpError(
    "ResourceNotFound",
    `Logic App '${logicAppName}' not found in resource group '${resourceGroupName}'`
  );
}

/**
 * Get Standard Logic App hostname and master key for Workflow Management API.
 * Results are cached to reduce API calls.
 */
export async function getStandardAppAccess(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string
): Promise<{ hostname: string; masterKey: string }> {
  const cacheKey = getCacheKey(subscriptionId, resourceGroupName, logicAppName);

  // Check cache first
  const cached = accessCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // Fetch from API (in parallel for better performance)
  const [site, keys] = await Promise.all([
    armRequest<{ properties: { defaultHostName: string } }>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}`,
      { queryParams: { "api-version": "2023-01-01" } }
    ),
    armRequest<{ masterKey: string }>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}/host/default/listkeys`,
      { method: "POST", queryParams: { "api-version": "2023-01-01" } }
    ),
  ]);

  const result = {
    hostname: site.properties.defaultHostName,
    masterKey: keys.masterKey,
  };

  // Cache the result
  accessCache.set(cacheKey, {
    value: result,
    expiresAt: Date.now() + cacheTtlMs,
  });

  return result;
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
  // Normalize location to lowercase with no spaces (e.g., "West US 2" -> "westus2")
  const normalizedLocation = location.toLowerCase().replace(/\s+/g, "");
  const workflowId = encodeURIComponent(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}`
  );
  const fullRunId = encodeURIComponent(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/runs/${runId}`
  );
  return `https://portal.azure.com/#view/Microsoft_Azure_EMA/DesignerEditorConsumption.ReactView/id/${workflowId}/location/${normalizedLocation}/isReadOnly~/true/isMonitoringView~/true/runId/${fullRunId}`;
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
