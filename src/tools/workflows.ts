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
  StandardWorkflowUpdatePayload,
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

export interface CreateWorkflowResult {
  success: boolean;
  name: string;
  message: string;
}

/**
 * Create a new workflow.
 * - Consumption: Creates a new Logic App resource via ARM PUT
 * - Standard: Creates a new workflow within an existing Logic App
 */
export async function createWorkflow(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  definition: WorkflowDefinition,
  location?: string,
  workflowName?: string,
  kind?: string
): Promise<CreateWorkflowResult> {
  // Try to detect if this is an existing Standard app
  let sku: "consumption" | "standard" = "consumption";
  try {
    sku = await detectLogicAppSku(subscriptionId, resourceGroupName, logicAppName);
  } catch {
    // If detection fails, assume Consumption (creating new Logic App)
    sku = "consumption";
  }

  if (sku === "consumption" || !workflowName) {
    // Consumption: Create/update the entire Logic App resource
    if (!location) {
      throw new McpError(
        "InvalidParameter",
        "location is required when creating a Consumption Logic App"
      );
    }

    const payload = {
      location,
      properties: {
        definition,
        state: "Enabled",
      },
    };

    await armRequest<ConsumptionLogicApp>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}`,
      {
        method: "PUT",
        queryParams: { "api-version": "2019-05-01" },
        body: payload,
      }
    );

    return {
      success: true,
      name: logicAppName,
      message: `Consumption Logic App '${logicAppName}' has been created in '${resourceGroupName}'.`,
    };
  }

  // Standard: Create workflow within existing Logic App using ARM API
  const workflowPayload: StandardWorkflowUpdatePayload = {
    properties: {
      files: {
        "workflow.json": {
          definition,
          kind: kind ?? "Stateful",
        },
      },
    },
  };

  await armRequest(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}/workflows/${workflowName}`,
    {
      method: "PUT",
      queryParams: { "api-version": "2024-04-01" },
      body: workflowPayload,
    }
  );

  return {
    success: true,
    name: workflowName,
    message: `Workflow '${workflowName}' has been created in Standard Logic App '${logicAppName}'.`,
  };
}

export interface UpdateWorkflowResult {
  success: boolean;
  name: string;
  message: string;
}

/**
 * Update an existing workflow's definition.
 * - Consumption: Updates the Logic App resource via ARM PUT
 * - Standard: Updates the workflow within the Logic App
 */
export async function updateWorkflow(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  definition: WorkflowDefinition,
  workflowName?: string,
  kind?: string
): Promise<UpdateWorkflowResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    // Get current workflow to preserve other properties
    const current = await armRequest<ConsumptionLogicApp>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}`,
      { queryParams: { "api-version": "2019-05-01" } }
    );

    const payload = {
      location: current.location,
      properties: {
        definition,
        state: current.properties.state,
        parameters: current.properties.parameters,
      },
      tags: current.tags,
    };

    await armRequest<ConsumptionLogicApp>(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}`,
      {
        method: "PUT",
        queryParams: { "api-version": "2019-05-01" },
        body: payload,
      }
    );

    return {
      success: true,
      name: logicAppName,
      message: `Consumption workflow '${logicAppName}' has been updated.`,
    };
  }

  // Standard - requires workflowName
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps"
    );
  }

  // Standard: Update workflow using ARM API
  const workflowPayload: StandardWorkflowUpdatePayload = {
    properties: {
      files: {
        "workflow.json": {
          definition,
          kind: kind ?? "Stateful",
        },
      },
    },
  };

  await armRequest(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}/workflows/${workflowName}`,
    {
      method: "PUT",
      queryParams: { "api-version": "2024-04-01" },
      body: workflowPayload,
    }
  );

  return {
    success: true,
    name: workflowName,
    message: `Workflow '${workflowName}' in '${logicAppName}' has been updated.`,
  };
}

export interface DeleteWorkflowResult {
  success: boolean;
  name: string;
  message: string;
}

/**
 * Delete a workflow.
 * - Consumption: Deletes the entire Logic App resource
 * - Standard: Deletes a specific workflow within the Logic App
 */
export async function deleteWorkflow(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowName?: string
): Promise<DeleteWorkflowResult> {
  const sku = await detectLogicAppSku(
    subscriptionId,
    resourceGroupName,
    logicAppName
  );

  if (sku === "consumption") {
    await armRequest(
      `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows/${logicAppName}`,
      {
        method: "DELETE",
        queryParams: { "api-version": "2019-05-01" },
      }
    );

    return {
      success: true,
      name: logicAppName,
      message: `Consumption Logic App '${logicAppName}' has been deleted.`,
    };
  }

  // Standard - requires workflowName
  if (!workflowName) {
    throw new McpError(
      "InvalidParameter",
      "workflowName is required for Standard Logic Apps (to delete only a specific workflow)"
    );
  }

  // Standard: Delete workflow using ARM API
  await armRequest(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${logicAppName}/workflows/${workflowName}`,
    {
      method: "DELETE",
      queryParams: { "api-version": "2024-04-01" },
    }
  );

  return {
    success: true,
    name: workflowName,
    message: `Workflow '${workflowName}' has been deleted from '${logicAppName}'.`,
  };
}
