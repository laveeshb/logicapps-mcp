/**
 * HTTP client wrapper with automatic authentication.
 * Handles token injection, retries, and pagination.
 */

import { getAccessToken } from "../auth/tokenManager.js";
import { getCloudEndpoints } from "../config/clouds.js";
import { McpError } from "./errors.js";

export interface ArmResponse<T> {
  value: T[];
  nextLink?: string;
}

export async function armRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    queryParams?: Record<string, string>;
  } = {}
): Promise<T> {
  const cloud = getCloudEndpoints();
  const token = await getAccessToken();

  let url = `${cloud.resourceManager}${path}`;

  if (options.queryParams) {
    const params = new URLSearchParams(options.queryParams);
    url += (url.includes("?") ? "&" : "?") + params.toString();
  }

  const response = await fetch(url, {
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

  return (await response.json()) as T;
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
      // nextLink is a full URL, fetch directly
      const token = await getAccessToken();
      const res = await fetch(nextLink!, {
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
  masterKey: string
): Promise<T> {
  const url = `https://${logicAppHostname}${path}`;

  const response = await fetch(url, {
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

  return (await response.json()) as T;
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
