/**
 * Token manager.
 * Uses a passthrough bearer token from the client when one is set. In local
 * stdio mode only, falls back to the Azure CLI login. Cloud hosts never use
 * the fallback.
 */

import { LogicAppsMcpSettings } from "../config/settings.js";
import { getCloudEndpoints } from "../config/clouds.js";
import { McpError } from "../utils/errors.js";
import { getAzureCliToken } from "./azureCli.js";

// Refresh the cached Azure CLI token this long before it expires.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

let cachedSettings: LogicAppsMcpSettings | null = null;
let passthroughToken: string | null = null;
let localCliAuth = false;
let cliToken: { accessToken: string; expiresOn: Date } | null = null;
let cliTokenPending: Promise<string> | null = null;

/**
 * Lets getAccessToken() fall back to the Azure CLI login when no passthrough
 * token is set. Called only from the local stdio entry point.
 */
export function enableLocalCliAuth(): void {
  localCliAuth = true;
}

export function setSettings(settings: LogicAppsMcpSettings): void {
  cachedSettings = settings;
}

/**
 * Sets a passthrough token to be used for ARM API calls.
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
 * Initializes settings (no auth check needed, tokens are fetched per call).
 */
export async function initializeAuth(): Promise<void> {
  if (!cachedSettings) {
    throw new McpError("AuthenticationError", "Settings not initialized");
  }
  console.error(
    localCliAuth
      ? "MCP server ready (using Azure CLI login)"
      : "MCP server ready (passthrough auth mode)"
  );
}

/**
 * Gets the Azure CLI token, reusing it until shortly before it expires.
 * Calls that arrive while `az` is running share the same call.
 */
function getCliAccessToken(): Promise<string> {
  if (cliToken && cliToken.expiresOn.getTime() - Date.now() > REFRESH_MARGIN_MS) {
    return Promise.resolve(cliToken.accessToken);
  }
  if (!cliTokenPending) {
    cliTokenPending = getAzureCliToken(getCloudEndpoints().authentication.tokenAudience)
      .then((token) => {
        cliToken = { accessToken: token.accessToken, expiresOn: token.expiresOn };
        return token.accessToken;
      })
      .finally(() => {
        cliTokenPending = null;
      });
  }
  return cliTokenPending;
}

/**
 * Gets a valid access token for Azure ARM API.
 * A passthrough token wins. Otherwise local stdio mode uses the Azure CLI
 * login; any other mode requires a passthrough token.
 */
export async function getAccessToken(): Promise<string> {
  if (passthroughToken) {
    return passthroughToken;
  }

  if (localCliAuth) {
    return getCliAccessToken();
  }

  throw new McpError(
    "AuthenticationError",
    "Bearer token required. Provide Authorization header with ARM-scoped token."
  );
}

/**
 * Clears the passthrough token and the cached Azure CLI token.
 */
export async function logout(): Promise<void> {
  clearPassthroughToken();
  cliToken = null;
}
