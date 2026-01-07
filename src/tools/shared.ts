/**
 * Shared utilities used across multiple tool implementations.
 */

import { armRequest } from "../utils/http.js";
import { McpError } from "../utils/errors.js";

// ============================================================================
// LRU Cache Implementation
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Maximum cache size (default: 100 entries per cache)
const MAX_CACHE_SIZE = 100;

/**
 * LRU Cache with TTL support.
 * Uses Map's insertion order for LRU tracking - recently accessed items are re-inserted.
 */
class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;

  constructor(maxSize: number = MAX_CACHE_SIZE) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    // Remove if exists (to update position)
    this.cache.delete(key);

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  deleteByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// In-memory LRU caches
const skuCache = new LRUCache<"consumption" | "standard">();
const accessCache = new LRUCache<{ hostname: string; masterKey: string }>();

// In-flight promises for cache stampede protection
const skuInFlight = new Map<string, Promise<"consumption" | "standard">>();
const accessInFlight = new Map<string, Promise<{ hostname: string; masterKey: string }>>();

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

  // Validate: if logicAppName is provided, resourceGroupName is required
  if (logicAppName && !resourceGroupName) {
    throw new Error("resourceGroupName is required when logicAppName is provided");
  }

  const prefix = logicAppName
    ? getCacheKey(subscriptionId, resourceGroupName ?? "", logicAppName)
    : `${subscriptionId}/${resourceGroupName ?? ""}`.toLowerCase();

  skuCache.deleteByPrefix(prefix);
  accessCache.deleteByPrefix(prefix);
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
 * Uses in-flight tracking to prevent cache stampede.
 */
export async function detectLogicAppSku(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string
): Promise<"consumption" | "standard"> {
  const cacheKey = getCacheKey(subscriptionId, resourceGroupName, logicAppName);

  // Check cache first (LRUCache handles TTL internally)
  const cached = skuCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Check if there's already an in-flight request for this key
  const inFlight = skuInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  // Create promise and track it to prevent concurrent duplicate requests
  const promise = detectSkuFromApi(subscriptionId, resourceGroupName, logicAppName)
    .then((sku) => {
      // Cache the result
      skuCache.set(cacheKey, sku, cacheTtlMs);
      return sku;
    })
    .finally(() => {
      // Clean up in-flight tracking
      skuInFlight.delete(cacheKey);
    });

  skuInFlight.set(cacheKey, promise);
  return promise;
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
 * Uses in-flight tracking to prevent cache stampede.
 */
export async function getStandardAppAccess(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string
): Promise<{ hostname: string; masterKey: string }> {
  const cacheKey = getCacheKey(subscriptionId, resourceGroupName, logicAppName);

  // Check cache first (LRUCache handles TTL internally)
  const cached = accessCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Check if there's already an in-flight request for this key
  const inFlight = accessInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  // Create promise and track it to prevent concurrent duplicate requests
  const promise = fetchStandardAppAccessFromApi(
    subscriptionId,
    resourceGroupName,
    logicAppName
  )
    .then((result) => {
      // Cache the result
      accessCache.set(cacheKey, result, cacheTtlMs);
      return result;
    })
    .finally(() => {
      // Clean up in-flight tracking
      accessInFlight.delete(cacheKey);
    });

  accessInFlight.set(cacheKey, promise);
  return promise;
}

/**
 * Internal: Fetch Standard Logic App access from API.
 */
async function fetchStandardAppAccessFromApi(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string
): Promise<{ hostname: string; masterKey: string }> {
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
