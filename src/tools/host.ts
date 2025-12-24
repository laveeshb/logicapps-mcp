/**
 * Host operations for Standard Logic Apps.
 */

import { workflowMgmtRequest } from "../utils/http.js";
import { HostStatus } from "../types/logicApp.js";
import { McpError } from "../utils/errors.js";
import { detectLogicAppSku, getStandardAppAccess } from "./shared.js";

export interface GetHostStatusResult {
  sku: "standard";
  state: string;
  version: string;
  platformVersion?: string;
  extensionBundle?: {
    id: string;
    version: string;
  };
  instanceId?: string;
  computerName?: string;
  processUptimeMs?: number;
}

/**
 * Get host status for a Standard Logic App.
 * This includes runtime version, extension bundle version, and other diagnostics.
 * Only available for Standard SKU.
 */
export async function getHostStatus(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string
): Promise<GetHostStatusResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    throw new McpError(
      "UnsupportedOperation",
      "Host status is only available for Standard Logic Apps. Consumption Logic Apps do not expose this endpoint."
    );
  }

  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  const status = await workflowMgmtRequest<HostStatus>(
    hostname,
    `/admin/host/status`,
    masterKey
  );

  return {
    sku: "standard",
    state: status.state,
    version: status.version,
    platformVersion: status.platformVersion,
    extensionBundle: status.extensionBundle,
    instanceId: status.instanceId,
    computerName: status.computerName,
    processUptimeMs: status.processUptime,
  };
}
