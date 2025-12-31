/**
 * Integration test setup - auto-discovers Azure resources.
 * No configuration required - just `az login` and run tests.
 */

import { listSubscriptions } from "../tools/subscriptions.js";
import { listLogicApps } from "../tools/logicApps.js";
import { listWorkflows } from "../tools/workflows.js";
import { getConnections } from "../tools/connections.js";

/**
 * Discovered Azure resources for testing.
 */
export interface TestResources {
  subscriptionId: string;
  resourceGroup: string;
  standardLogicApp?: {
    name: string;
    workflowName?: string;
  };
  consumptionLogicApp?: {
    name: string;
  };
  connectionName?: string;
}

let cachedResources: TestResources | null = null;
let discoveryFailed = false;

/**
 * Auto-discover Azure resources for testing.
 * Finds first available subscription, Logic Apps, and connections.
 */
export async function discoverTestResources(): Promise<TestResources | null> {
  if (cachedResources) return cachedResources;
  if (discoveryFailed) return null;

  try {
    // Get first subscription
    const subs = await listSubscriptions();
    if (subs.subscriptions.length === 0) {
      console.log("No Azure subscriptions found. Run 'az login' first.");
      discoveryFailed = true;
      return null;
    }
    const subscriptionId = subs.subscriptions[0].subscriptionId;

    // Find Logic Apps across resource groups
    const allApps = await listLogicApps(subscriptionId);
    if (allApps.logicApps.length === 0) {
      console.log("No Logic Apps found in subscription.");
      discoveryFailed = true;
      return null;
    }

    // Get resource group from first Logic App
    const firstApp = allApps.logicApps[0];
    const resourceGroup = extractResourceGroup(firstApp.id);

    // Find Standard and Consumption Logic Apps
    const standardApp = allApps.logicApps.find((app) => app.sku === "standard");
    const consumptionApp = allApps.logicApps.find((app) => app.sku === "consumption");

    // Get workflow name for Standard app
    let workflowName: string | undefined;
    if (standardApp) {
      const stdRg = extractResourceGroup(standardApp.id);
      const workflows = await listWorkflows(subscriptionId, stdRg, standardApp.name);
      if (workflows.workflows.length > 0) {
        workflowName = workflows.workflows[0].name;
      }
    }

    // Try to find a connection
    let connectionName: string | undefined;
    try {
      const connections = await getConnections(subscriptionId, resourceGroup);
      if (connections.connections.length > 0) {
        connectionName = connections.connections[0].name;
      }
    } catch {
      // Connections are optional
    }

    cachedResources = {
      subscriptionId,
      resourceGroup,
      standardLogicApp: standardApp
        ? {
            name: standardApp.name,
            workflowName,
          }
        : undefined,
      consumptionLogicApp: consumptionApp
        ? {
            name: consumptionApp.name,
          }
        : undefined,
      connectionName,
    };

    return cachedResources;
  } catch (error) {
    console.log("Failed to discover Azure resources:", error);
    discoveryFailed = true;
    return null;
  }
}

/**
 * Extract resource group name from Azure resource ID.
 */
function extractResourceGroup(resourceId: string): string {
  const match = resourceId.match(/resourceGroups\/([^/]+)/i);
  return match ? match[1] : "";
}

/**
 * Check if integration tests can run.
 */
export async function canRunIntegrationTests(): Promise<boolean> {
  const resources = await discoverTestResources();
  return resources !== null;
}
