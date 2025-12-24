/**
 * Gets access tokens from Azure CLI.
 * Requires user to have run `az login` beforehand.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { McpError } from "../utils/errors.js";

const execAsync = promisify(exec);

export interface AzureCliToken {
  accessToken: string;
  expiresOn: Date;
  subscription: string;
  tenant: string;
  tokenType: string;
}

interface AzureCliTokenResponse {
  accessToken: string;
  expiresOn: string;
  subscription: string;
  tenant: string;
  tokenType: string;
}

/**
 * Gets an access token from Azure CLI for the ARM management API.
 * Throws if Azure CLI is not installed or user is not logged in.
 */
export async function getAzureCliToken(
  resource: string = "https://management.azure.com"
): Promise<AzureCliToken> {
  try {
    // Use exec with shell to handle az.cmd on Windows
    const command = `az account get-access-token --resource "${resource}" --output json`;
    const { stdout } = await execAsync(command);

    const response = JSON.parse(stdout) as AzureCliTokenResponse;

    return {
      accessToken: response.accessToken,
      expiresOn: new Date(response.expiresOn),
      subscription: response.subscription,
      tenant: response.tenant,
      tokenType: response.tokenType,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("ENOENT") || errorMessage.includes("not found")) {
      throw new McpError(
        "AuthenticationError",
        "Azure CLI is not installed. Please install it from https://aka.ms/installazurecli"
      );
    }

    if (
      errorMessage.includes("az login") ||
      errorMessage.includes("not logged in") ||
      errorMessage.includes("AADSTS")
    ) {
      throw new McpError(
        "AuthenticationError",
        "Not logged in to Azure CLI. Please run: az login"
      );
    }

    throw new McpError(
      "AuthenticationError",
      `Failed to get token from Azure CLI: ${errorMessage}`
    );
  }
}

/**
 * Checks if Azure CLI is available and user is logged in.
 * Returns subscription info if successful.
 */
export async function checkAzureCliAuth(): Promise<{
  loggedIn: boolean;
  subscription?: string;
  tenant?: string;
  error?: string;
}> {
  try {
    const token = await getAzureCliToken();
    return {
      loggedIn: true,
      subscription: token.subscription,
      tenant: token.tenant,
    };
  } catch (error) {
    return {
      loggedIn: false,
      error: error instanceof McpError ? error.message : String(error),
    };
  }
}
