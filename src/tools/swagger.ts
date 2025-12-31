/**
 * Workflow swagger/OpenAPI tools.
 */

import { armRequest, workflowMgmtRequest } from "../utils/http.js";
import { McpError } from "../utils/errors.js";
import { detectLogicAppSku, getStandardAppAccess } from "./shared.js";

// Consumer-facing result type
export interface GetWorkflowSwaggerResult {
  swagger: {
    swagger?: string;
    info?: {
      title?: string;
      version?: string;
    };
    host?: string;
    basePath?: string;
    schemes?: string[];
    paths?: Record<string, unknown>;
    definitions?: Record<string, unknown>;
  };
}

/**
 * Get the OpenAPI/Swagger definition for a workflow.
 * Shows available triggers and their schemas.
 */
export async function getWorkflowSwagger(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName?: string
): Promise<GetWorkflowSwaggerResult> {
  const sku = await detectLogicAppSku(subscriptionId, resourceGroupName, logicAppName);

  if (sku === "consumption") {
    return getSwaggerConsumption(subscriptionId, resourceGroupName, logicAppName);
  }

  // Standard requires workflowName
  if (!workflowName) {
    throw new McpError("InvalidParameter", "workflowName is required for Standard Logic Apps");
  }

  return getSwaggerStandard(subscriptionId, resourceGroupName, logicAppName, workflowName);
}

async function getSwaggerConsumption(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string
): Promise<GetWorkflowSwaggerResult> {
  const swagger = await armRequest<Record<string, unknown>>(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/listSwagger`,
    { method: "POST", queryParams: { "api-version": "2019-05-01" } }
  );

  return {
    swagger: {
      swagger: swagger.swagger as string | undefined,
      info: swagger.info as { title?: string; version?: string } | undefined,
      host: swagger.host as string | undefined,
      basePath: swagger.basePath as string | undefined,
      schemes: swagger.schemes as string[] | undefined,
      paths: swagger.paths as Record<string, unknown> | undefined,
      definitions: swagger.definitions as Record<string, unknown> | undefined,
    },
  };
}

async function getSwaggerStandard(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName: string
): Promise<GetWorkflowSwaggerResult> {
  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  // Standard uses workflow management API
  const swagger = await workflowMgmtRequest<Record<string, unknown>>(
    hostname,
    `/runtime/webhooks/workflow/api/management/workflows/${workflowName}/listSwagger?api-version=2020-05-01-preview`,
    masterKey
  );

  return {
    swagger: {
      swagger: swagger.swagger as string | undefined,
      info: swagger.info as { title?: string; version?: string } | undefined,
      host: swagger.host as string | undefined,
      basePath: swagger.basePath as string | undefined,
      schemes: swagger.schemes as string[] | undefined,
      paths: swagger.paths as Record<string, unknown> | undefined,
      definitions: swagger.definitions as Record<string, unknown> | undefined,
    },
  };
}
