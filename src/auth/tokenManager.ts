/**
 * Manages token lifecycle using Azure Identity SDK.
 * Works both locally (Azure CLI) and in Azure (Managed Identity).
 *
 * Supports passthrough authentication: if a bearer token is provided
 * via setPassthroughToken(), it will be used instead of DefaultAzureCredential.
 */

import { FlowieSettings } from "../config/settings.js";
import { getToken, checkAuth, clearCache } from "./azureIdentity.js";
import { McpError } from "../utils/errors.js";

let cachedSettings: FlowieSettings | null = null;
let passthroughToken: string | null = null;

export function setSettings(settings: FlowieSettings): void {
  cachedSettings = settings;
}

/**
 * Sets a passthrough token to be used for ARM API calls.
 * When set, this token is used instead of DefaultAzureCredential.
 */
export function setPassthroughToken(token: string): void {
  passthroughToken = token;
}

/**
 * Clears the passthrough token.
 * Should be called after each request to avoid token leakage.
 */
export function clearPassthroughToken(): void {
  passthroughToken = null;
}

/**
 * Initializes authentication at server startup.
 * Verifies Azure credentials are available.
 * Throws if authentication fails.
 */
export async function initializeAuth(): Promise<void> {
  if (!cachedSettings) {
    throw new McpError("AuthenticationError", "Settings not initialized");
  }

  const authStatus = await checkAuth();

  if (!authStatus.authenticated) {
    throw new McpError(
      "AuthenticationError",
      `Azure authentication required. ${authStatus.error ?? "Please run: az login (locally) or configure Managed Identity (in Azure)"}`
    );
  }

  console.error("Authenticated with Azure (using DefaultAzureCredential)");
}

/**
 * Gets a valid access token for Azure ARM API.
 * If a passthrough token is set, returns it directly.
 * Otherwise, uses DefaultAzureCredential (Managed Identity / Azure CLI).
 */
export async function getAccessToken(): Promise<string> {
  // If passthrough token is set, use it
  if (passthroughToken) {
    return passthroughToken;
  }

  // Fall back to DefaultAzureCredential
  if (!cachedSettings) {
    throw new McpError("AuthenticationError", "Settings not initialized");
  }

  // Convert resource URL to scope format (.default suffix)
  const audience = cachedSettings.cloud.authentication.tokenAudience;
  const scope = audience.endsWith("/.default") ? audience : `${audience}/.default`;

  return getToken(scope);
}

/**
 * Clears cached tokens.
 */
export async function logout(): Promise<void> {
  clearCache();
  console.error("Cleared cached tokens.");
}
