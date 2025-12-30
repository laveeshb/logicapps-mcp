/**
 * Azure Identity-based authentication.
 * Uses DefaultAzureCredential which automatically handles:
 * - Local: Azure CLI, Azure PowerShell, VS Code, etc.
 * - Cloud: Managed Identity (System or User-Assigned)
 */

import { DefaultAzureCredential, AccessToken } from "@azure/identity";
import { McpError } from "../utils/errors.js";

let credential: DefaultAzureCredential | null = null;
let cachedToken: AccessToken | null = null;
let cachedScope: string | null = null;

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

/**
 * Gets the shared credential instance.
 */
function getCredential(): DefaultAzureCredential {
  if (!credential) {
    credential = new DefaultAzureCredential();
  }
  return credential;
}

/**
 * Gets an access token for the specified scope.
 * Uses DefaultAzureCredential which works both locally (Azure CLI) and in Azure (Managed Identity).
 */
export async function getToken(
  scope: string = "https://management.azure.com/.default"
): Promise<string> {
  try {
    // Check if we have a valid cached token for the same scope
    if (cachedToken && cachedScope === scope) {
      const now = Date.now();
      const expiresAt = cachedToken.expiresOnTimestamp;

      // Token still valid (with buffer)
      if (expiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
        return cachedToken.token;
      }
    }

    // Get fresh token
    const cred = getCredential();
    cachedToken = await cred.getToken(scope);
    cachedScope = scope;

    if (!cachedToken) {
      throw new McpError(
        "AuthenticationError",
        "Failed to get access token - no token returned"
      );
    }

    return cachedToken.token;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    // Provide helpful error messages
    if (errorMessage.includes("EnvironmentCredential") ||
        errorMessage.includes("ManagedIdentityCredential") ||
        errorMessage.includes("AzureCliCredential")) {
      throw new McpError(
        "AuthenticationError",
        `Azure authentication failed. Locally, run 'az login'. In Azure, ensure Managed Identity is configured. Details: ${errorMessage}`
      );
    }

    throw new McpError(
      "AuthenticationError",
      `Failed to get Azure access token: ${errorMessage}`
    );
  }
}

/**
 * Checks if authentication is available.
 * Returns info about the authentication method being used.
 */
export async function checkAuth(): Promise<{
  authenticated: boolean;
  error?: string;
}> {
  try {
    await getToken();
    return { authenticated: true };
  } catch (error) {
    return {
      authenticated: false,
      error: error instanceof McpError ? error.message : String(error),
    };
  }
}

/**
 * Clears cached tokens.
 */
export function clearCache(): void {
  cachedToken = null;
  cachedScope = null;
}
