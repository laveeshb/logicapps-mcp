/**
 * HTTP client wrapper with automatic authentication.
 * Handles token injection, retries, and pagination.
 */

import { getAccessToken } from "../auth/tokenManager.js";
import { getCloudEndpoints } from "../config/clouds.js";
import { McpError } from "./errors.js";

// ============================================================================
// Retry Configuration
// ============================================================================

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}

// Default configuration
let retryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  timeoutMs: 30000,
};

// Status codes that are retryable
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Configure retry behavior for HTTP requests.
 */
export function setRetryConfig(config: Partial<RetryConfig>): void {
  retryConfig = { ...retryConfig, ...config };
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with retry logic, exponential backoff, and timeout.
 */
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), retryConfig.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Success - return response
      if (response.ok) {
        return response;
      }

      // Non-retryable error - return immediately
      if (!RETRYABLE_STATUS_CODES.has(response.status)) {
        return response;
      }

      // Retryable error - calculate delay
      let delayMs: number;

      if (response.status === 429) {
        // Respect Retry-After header for rate limiting
        const retryAfter = response.headers.get("Retry-After");
        if (retryAfter) {
          // Retry-After can be seconds or a date
          const parsed = parseInt(retryAfter, 10);
          delayMs = isNaN(parsed) ? retryConfig.baseDelayMs : parsed * 1000;
        } else {
          delayMs = retryConfig.baseDelayMs * Math.pow(2, attempt);
        }
      } else {
        // Exponential backoff with jitter for other retryable errors
        delayMs = Math.min(
          retryConfig.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
          retryConfig.maxDelayMs
        );
      }

      // Don't retry if this was the last attempt
      if (attempt < retryConfig.maxRetries) {
        await sleep(delayMs);
      } else {
        return response;
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        lastError = new McpError("ServiceError", `Request timed out after ${retryConfig.timeoutMs}ms`);
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Network errors are retryable - continue if not last attempt
      if (attempt >= retryConfig.maxRetries) {
        throw lastError;
      }

      // Wait before retry
      const delayMs = Math.min(
        retryConfig.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        retryConfig.maxDelayMs
      );
      await sleep(delayMs);
    }
  }

  // Should not reach here, but just in case
  throw lastError ?? new Error("Request failed after retries");
}

export interface ArmResponse<T> {
  value: T[];
  nextLink?: string;
}

/**
 * Make a request to the Azure Resource Manager API.
 * Throws an error if the response body is empty when a response is expected.
 */
export async function armRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    queryParams?: Record<string, string>;
  } = {}
): Promise<T> {
  const response = await armRequestRaw(path, options);

  // Handle empty responses - throw error since caller expects data
  if (response.status === 204 || response.status === 202) {
    throw new McpError(
      "ServiceError",
      `Unexpected empty response (${response.status}) when data was expected`
    );
  }

  const text = await response.text();
  if (!text) {
    throw new McpError("ServiceError", "Unexpected empty response body when data was expected");
  }

  return JSON.parse(text) as T;
}

/**
 * Make a request to the Azure Resource Manager API that may not return a body.
 * Use this for DELETE operations or POST operations that return 202/204.
 */
export async function armRequestVoid(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    queryParams?: Record<string, string>;
  } = {}
): Promise<void> {
  await armRequestRaw(path, options);
}

/**
 * Internal: Make a raw ARM request and return the response.
 * Uses retry logic for transient errors.
 */
async function armRequestRaw(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    queryParams?: Record<string, string>;
  } = {}
): Promise<Response> {
  const cloud = getCloudEndpoints();
  const token = await getAccessToken();

  let url = `${cloud.resourceManager}${path}`;

  if (options.queryParams) {
    const params = new URLSearchParams(options.queryParams);
    url += (url.includes("?") ? "&" : "?") + params.toString();
  }

  const response = await fetchWithRetry(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    await handleArmError(response);
  }

  return response;
}

export async function armRequestAllPages<T>(
  path: string,
  queryParams?: Record<string, string>
): Promise<T[]> {
  const results: T[] = [];
  let nextLink: string | undefined = undefined;
  let isFirstRequest = true;

  while (isFirstRequest || nextLink) {
    let response: ArmResponse<T>;

    if (isFirstRequest) {
      response = await armRequest<ArmResponse<T>>(path, { queryParams });
      isFirstRequest = false;
    } else {
      // nextLink is a full URL, fetch directly with retry
      const token = await getAccessToken();
      const res = await fetchWithRetry(nextLink!, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        await handleArmError(res);
      }

      response = (await res.json()) as ArmResponse<T>;
    }

    results.push(...response.value);
    nextLink = response.nextLink;
  }

  return results;
}

export async function workflowMgmtRequest<T>(
  logicAppHostname: string,
  path: string,
  masterKey: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  } = {}
): Promise<T> {
  const url = `https://${logicAppHostname}${path}`;

  const response = await fetchWithRetry(url, {
    method: options.method ?? "GET",
    headers: {
      "x-functions-key": masterKey,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new McpError(
      "ServiceError",
      error.message ?? `Workflow management API error: ${response.status}`
    );
  }

  return (await response.json()) as T;
}

/**
 * Make a paginated request to the Workflow Management API for Standard Logic Apps.
 * Follows nextLink pagination to retrieve all results.
 */
export async function workflowMgmtRequestAllPages<T>(
  logicAppHostname: string,
  path: string,
  masterKey: string
): Promise<T[]> {
  const results: T[] = [];
  let url: string | undefined = `https://${logicAppHostname}${path}`;

  while (url) {
    const response = await fetchWithRetry(url, {
      method: "GET",
      headers: {
        "x-functions-key": masterKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new McpError(
        "ServiceError",
        error.message ?? `Workflow management API error: ${response.status}`
      );
    }

    const data = (await response.json()) as { value?: T[]; nextLink?: string };
    if (data.value) {
      results.push(...data.value);
    }
    url = data.nextLink;
  }

  return results;
}

/**
 * Make a request to the VFS (Kudu) API for Standard Logic Apps.
 * Used for creating, updating, and deleting workflow files.
 */
export async function vfsRequest(
  logicAppHostname: string,
  path: string,
  masterKey: string,
  options: {
    method?: "GET" | "PUT" | "DELETE";
    body?: unknown;
  } = {}
): Promise<void> {
  const url = `https://${logicAppHostname}${path}`;

  const response = await fetchWithRetry(url, {
    method: options.method ?? "GET",
    headers: {
      "x-functions-key": masterKey,
      "Content-Type": "application/json",
      // VFS API requires If-Match header for PUT/DELETE operations
      ...(options.method === "PUT" || options.method === "DELETE" ? { "If-Match": "*" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    // Handle conflict errors (409 Conflict, 412 Precondition Failed)
    if (response.status === 409 || response.status === 412) {
      throw new McpError(
        "ConflictError",
        response.status === 412
          ? "Resource was modified by another process. Please retry the operation."
          : `Conflict: ${errorText || "Resource already exists or is in a conflicting state."}`
      );
    }

    throw new McpError(
      "ServiceError",
      `VFS API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`
    );
  }
}

async function handleArmError(response: Response): Promise<never> {
  let errorData: { error?: { code?: string; message?: string } } = {};

  try {
    errorData = (await response.json()) as typeof errorData;
  } catch {
    // Response body isn't JSON
  }

  const code = errorData.error?.code ?? `HTTP${response.status}`;
  const message = errorData.error?.message ?? response.statusText;

  switch (response.status) {
    case 401:
      throw new McpError("AuthenticationError", message);
    case 403:
      throw new McpError("AuthorizationError", message);
    case 404:
      throw new McpError("ResourceNotFound", message);
    case 429:
      throw new McpError("RateLimited", message);
    default:
      throw new McpError(code, message);
  }
}
