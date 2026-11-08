/**
 * Loads user settings from environment variables and config file.
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { AzureCloudEndpoints, getCloudEndpoints } from "./clouds.js";

export interface LogicAppsMcpSettings {
  tenantId: string;
  clientId: string;
  cloud: AzureCloudEndpoints;
  defaultSubscriptionId?: string;
  logLevel: "debug" | "info" | "warn" | "error";
  cacheTtlSeconds: number;
  readOnly: boolean;
}

interface ConfigFile {
  tenantId?: string;
  clientId?: string;
  defaultSubscriptionId?: string;
  customCloud?: AzureCloudEndpoints;
  readOnly?: unknown;
}

const DEFAULT_CLIENT_ID = "04b07795-8ddb-461a-bbee-02f9e1bf7b46"; // Azure CLI public client ID

/**
 * Reads the read-only setting from the environment variable or the config
 * file. An empty value counts as not set. Any other value that is not clearly
 * "off" turns read-only mode on, because a typo should not leave write tools
 * available.
 */
function parseReadOnly(value: unknown, source: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "") return undefined;
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }
  console.error(`Unrecognised ${source} value ${JSON.stringify(value)}, using read-only mode`);
  return true;
}

export async function loadSettings(): Promise<LogicAppsMcpSettings> {
  // Try to load config file
  let configFile: ConfigFile = {};
  const configPath = join(homedir(), ".logicapps-mcp", "config.json");
  let content: string | undefined;
  try {
    content = await readFile(configPath, "utf-8");
  } catch {
    // No config file, use defaults
  }
  if (content !== undefined) {
    try {
      configFile = JSON.parse(content);
    } catch {
      console.error(`Ignoring ${configPath}: it is not valid JSON`);
    }
  }

  // Determine cloud endpoints
  let cloud: AzureCloudEndpoints;
  if (configFile.customCloud) {
    cloud = configFile.customCloud;
  } else {
    cloud = getCloudEndpoints(process.env.AZURE_CLOUD);
  }

  return {
    tenantId: process.env.AZURE_TENANT_ID ?? configFile.tenantId ?? "common",
    clientId: process.env.AZURE_CLIENT_ID ?? configFile.clientId ?? DEFAULT_CLIENT_ID,
    cloud,
    defaultSubscriptionId: process.env.AZURE_SUBSCRIPTION_ID ?? configFile.defaultSubscriptionId,
    logLevel: (process.env.LOGICAPPS_MCP_LOG_LEVEL as LogicAppsMcpSettings["logLevel"]) ?? "info",
    cacheTtlSeconds: parseInt(process.env.LOGICAPPS_MCP_CACHE_TTL ?? "300", 10),
    readOnly:
      parseReadOnly(process.env.LOGICAPPS_MCP_READ_ONLY, "LOGICAPPS_MCP_READ_ONLY") ??
      parseReadOnly(configFile.readOnly, "readOnly in config.json") ??
      false,
  };
}
