/**
 * Manages token lifecycle using Azure CLI.
 * Requires user to have run `az login` beforehand.
 */

import { FlowieSettings } from "../config/settings.js";
import { getAzureCliToken, checkAzureCliAuth, AzureCliToken } from "./azureCli.js";
import { McpError } from "../utils/errors.js";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

let cachedSettings: FlowieSettings | null = null;
let cachedToken: AzureCliToken | null = null;

export function setSettings(settings: FlowieSettings): void {
  cachedSettings = settings;
}

/**
 * Initializes authentication at server startup.
 * Verifies Azure CLI is available and user is logged in.
 * Throws if authentication fails.
 */
export async function initializeAuth(): Promise<void> {
  if (!cachedSettings) {
    throw new McpError("AuthenticationError", "Settings not initialized");
  }

  const authStatus = await checkAzureCliAuth();

  if (!authStatus.loggedIn) {
    throw new McpError(
      "AuthenticationError",
      `Azure CLI authentication required. ${authStatus.error ?? "Please run: az login"}`
    );
  }

  // Cache the token
  cachedToken = await getAzureCliToken(
    cachedSettings.cloud.authentication.tokenAudience
  );

  console.error(
    `Authenticated with Azure CLI (subscription: ${cachedToken.subscription})`
  );
}

/**
 * Gets a valid access token for Azure ARM API.
 * Automatically refreshes if expired or about to expire.
 */
export async function getAccessToken(): Promise<string> {
  if (!cachedSettings) {
    throw new McpError("AuthenticationError", "Settings not initialized");
  }

  // Check if we have a valid cached token
  if (cachedToken) {
    const now = Date.now();
    const expiresAt = cachedToken.expiresOn.getTime();

    // Token still valid (with buffer)
    if (expiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
      return cachedToken.accessToken;
    }
  }

  // Get fresh token from Azure CLI
  cachedToken = await getAzureCliToken(
    cachedSettings.cloud.authentication.tokenAudience
  );

  return cachedToken.accessToken;
}

/**
 * Clears cached tokens.
 */
export async function logout(): Promise<void> {
  cachedToken = null;
  console.error("Cleared cached tokens. Run 'az logout' to sign out of Azure CLI.");
}
