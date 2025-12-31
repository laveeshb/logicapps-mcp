/**
 * Token manager for passthrough authentication.
 * Requires a bearer token from the client - no local credential fallback.
 */

import { LogicAppsMcpSettings } from "../config/settings.js";
import { McpError } from "../utils/errors.js";

let cachedSettings: LogicAppsMcpSettings | null = null;
let passthroughToken: string | null = null;

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
 * Initializes settings (no auth check needed - passthrough only).
 */
export async function initializeAuth(): Promise<void> {
  if (!cachedSettings) {
    throw new McpError("AuthenticationError", "Settings not initialized");
  }
  console.error("MCP server ready (passthrough auth mode)");
}

/**
 * Gets a valid access token for Azure ARM API.
 * Requires a passthrough token - no fallback.
 */
export async function getAccessToken(): Promise<string> {
  if (!passthroughToken) {
    throw new McpError(
      "AuthenticationError",
      "Bearer token required. Provide Authorization header with ARM-scoped token."
    );
  }

  return passthroughToken;
}

/**
 * No-op for passthrough mode.
 */
export async function logout(): Promise<void> {
  clearPassthroughToken();
}
