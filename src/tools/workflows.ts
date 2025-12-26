/**
 * Workflow operations for both SKUs.
 */

import {
  armRequest,
  armRequestAllPages,
  workflowMgmtRequest,
} from "../utils/http.js";
import {
  ConsumptionLogicApp,
  StandardWorkflow,
  StandardWorkflowDefinitionFile,
  TriggerState,
  WorkflowDefinition,
  WorkflowVersion,
} from "../types/logicApp.js";
import { McpError } from "../utils/errors.js";
import { detectLogicAppSku, getStandardAppAccess } from "./shared.js";

export interface ListWorkflowsResult {
  workflows: Array<{
    name: string;
    state: string;
    kind?: string;
    createdTime?: string;
    changedTime?: string;
  }>;
}

export interface GetWorkflowDefinitionResult {
  definition: WorkflowDefinition;
  parameters?: Record<string, unknown>;
}

export interface GetWorkflowTriggersResult {
  triggers: Array<{
    name: string;
    type: string;
    state: string;
    lastExecutionTime?: string;
    nextExecutionTime?: string;
  }>;
}

export interface ListWorkflowVersionsResult {
  versions: Array<{
    version: string;
    createdTime: string;
    changedTime: string;
    state: string;
  }>;
}

/**
 * List workflows in a Standard Logic App.
 * For Consumption, returns a single workflow with the same name as the Logic App.
 */
export async function listWorkflows(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string
): Promise<ListWorkflowsResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    const workflow = await armRequest<ConsumptionLogicApp>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}`,
      { queryParams: { "api-version": "2019-05-01" } }
    );

    return {
      workflows: [
        {
          name: logicAppName,
          state: workflow.properties.state,
          createdTime: workflow.properties.createdTime,
          changedTime: workflow.properties.changedTime,
        },
      ],
    };
  }

  // Standard - use Workflow Management API (returns direct array)
  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );
  const workflows = await workflowMgmtRequest<StandardWorkflow[]>(
    hostname,
    `/runtime/webhooks/workflow/api/management/workflows?api-version=2020-05-01-preview`,
    masterKey
  );

  return {
    workflows: workflows.map((wf) => ({
      name: wf.name,
      state: wf.isDisabled ? "Disabled" : "Enabled",
      kind: wf.kind,
    })),
  };
}

/**
 * Get workflow definition.
 */
export async function getWorkflowDefinition(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName?: string
): Promise<GetWorkflowDefinitionResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    const workflow = await armRequest<ConsumptionLogicApp>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}`,
      { queryParams: { "api-version": "2019-05-01" } }
    );

    return {
      definition: workflow.properties.definition,
      parameters: workflow.properties.parameters,
    };
  }

  // Standard - get definition from VFS endpoint
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps"
    );
  }

  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );
  
  // The workflow definition is stored in the VFS at /admin/vfs/site/wwwroot/{workflowName}/workflow.json
  const definitionFile = await workflowMgmtRequest<StandardWorkflowDefinitionFile>(
    hostname,
    `/admin/vfs/site/wwwroot/${workflowName}/workflow.json`,
    masterKey
  );

  return {
    definition: definitionFile.definition,
  };
}

/**
 * Get workflow triggers.
 */
export async function getWorkflowTriggers(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName?: string
): Promise<GetWorkflowTriggersResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    const triggers = await armRequestAllPages<TriggerState>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/triggers`,
      { "api-version": "2019-05-01" }
    );

    return {
      triggers: triggers.map((t) => ({
        name: t.name,
        type: t.type,
        state: t.properties.state,
        lastExecutionTime: t.properties.lastExecutionTime,
        nextExecutionTime: t.properties.nextExecutionTime,
      })),
    };
  }

  // Standard - get triggers from workflow metadata (available in list/get workflow response)
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps"
    );
  }

  const { hostname, masterKey } = await getStandardAppAccess(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );
  
  const workflow = await workflowMgmtRequest<StandardWorkflow>(
    hostname,
    `/runtime/webhooks/workflow/api/management/workflows/${workflowName}?api-version=2020-05-01-preview`,
    masterKey
  );

  return {
    triggers: Object.entries(workflow.triggers ?? {}).map(
      ([name, trigger]) => ({
        name,
        type: trigger.type,
        state: workflow.isDisabled ? "Disabled" : "Enabled",
      })
    ),
  };
}

/**
 * List workflow versions (Consumption SKU only).
 * Each time a Consumption Logic App is saved, a new version is created.
 */
export async function listWorkflowVersions(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  top?: number
): Promise<ListWorkflowVersionsResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku !== "consumption") {
    throw new McpError(
      "InvalidParameter",
      "Workflow versions are only available for Consumption Logic Apps. Standard Logic Apps store versions in source control."
    );
  }

  const queryParams: Record<string, string> = { "api-version": "2019-05-01" };
  if (top) {
    queryParams["$top"] = String(top);
  }

  const versions = await armRequestAllPages<WorkflowVersion>(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/versions`,
    queryParams
  );

  return {
    versions: versions.map((v) => ({
      version: v.name,
      createdTime: v.properties.createdTime,
      changedTime: v.properties.changedTime,
      state: v.properties.state,
    })),
  };
}

export interface GetWorkflowVersionResult {
  version: string;
  createdTime: string;
  changedTime: string;
  state: string;
  definition: WorkflowDefinition;
  parameters?: Record<string, unknown>;
}

/**
 * Get a specific historical version's definition (Consumption SKU only).
 */
export async function getWorkflowVersion(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  versionId: string
): Promise<GetWorkflowVersionResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku !== "consumption") {
    throw new McpError(
      "InvalidParameter",
      "Workflow versions are only available for Consumption Logic Apps. Standard Logic Apps store versions in source control."
    );
  }

  const version = await armRequest<WorkflowVersion>(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/versions/${versionId}`,
    { queryParams: { "api-version": "2019-05-01" } }
  );

  return {
    version: version.name,
    createdTime: version.properties.createdTime,
    changedTime: version.properties.changedTime,
    state: version.properties.state,
    definition: version.properties.definition,
    parameters: version.properties.parameters,
  };
}

// ============================================================================
// Write Operations
// ============================================================================

export interface EnableDisableWorkflowResult {
  success: boolean;
  name: string;
  state: "Enabled" | "Disabled";
  message: string;
}

/**
 * Enable a workflow (set state to Enabled).
 */
export async function enableWorkflow(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName?: string
): Promise<EnableDisableWorkflowResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    await armRequest(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/enable`,
      { method: "POST", queryParams: { "api-version": "2019-05-01" } }
    );

    return {
      success: true,
      name: logicAppName,
      state: "Enabled",
      message: `Consumption workflow '${logicAppName}' has been enabled.`,
    };
  }

  // Standard - requires workflowName
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps"
    );
  }

  // Standard Logic Apps use the ARM API at Microsoft.Web/sites/{siteName}/workflows/{workflowName}
  // to enable/disable workflows via a PATCH request
  await armRequest(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}/workflows/${workflowName}`,
    {
      method: "PATCH",
      queryParams: { "api-version": "2024-04-01" },
      body: {
        properties: {
          state: "Enabled",
        },
      },
    }
  );

  return {
    success: true,
    name: workflowName,
    state: "Enabled",
    message: `Standard workflow '${workflowName}' in '${logicAppName}' has been enabled.`,
  };
}

/**
 * Disable a workflow (set state to Disabled).
 */
export async function disableWorkflow(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName?: string
): Promise<EnableDisableWorkflowResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    await armRequest(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}/disable`,
      { method: "POST", queryParams: { "api-version": "2019-05-01" } }
    );

    return {
      success: true,
      name: logicAppName,
      state: "Disabled",
      message: `Consumption workflow '${logicAppName}' has been disabled.`,
    };
  }

  // Standard - requires workflowName
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps"
    );
  }

  // Standard Logic Apps use the ARM API at Microsoft.Web/sites/{siteName}/workflows/{workflowName}
  // to enable/disable workflows via a PATCH request
  await armRequest(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}/workflows/${workflowName}`,
    {
      method: "PATCH",
      queryParams: { "api-version": "2024-04-01" },
      body: {
        properties: {
          state: "Disabled",
        },
      },
    }
  );

  return {
    success: true,
    name: workflowName,
    state: "Disabled",
    message: `Standard workflow '${workflowName}' in '${logicAppName}' has been disabled.`,
  };
}
