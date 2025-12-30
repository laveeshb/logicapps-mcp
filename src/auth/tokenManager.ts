/**
 * Manages token lifecycle using Azure Identity SDK.
 * Works both locally (Azure CLI) and in Azure (Managed Identity).
 */

import { FlowieSettings } from "../config/settings.js";
import { getToken, checkAuth, clearCache } from "./azureIdentity.js";
import { McpError } from "../utils/errors.js";

let cachedSettings: FlowieSettings | null = null;

export function setSettings(settings: FlowieSettings): void {
  cachedSettings = settings;
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
 * Automatically refreshes if expired or about to expire.
 */
export async function getAccessToken(): Promise<string> {
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
