/**
 * List Logic Apps across both Consumption and Standard SKUs.
 */

import { armRequestAllPages } from "../utils/http.js";
import {
  ConsumptionLogicApp,
  StandardLogicApp,
  LogicApp,
} from "../types/logicApp.js";
import { extractResourceGroup } from "./shared.js";

export interface ListLogicAppsResult {
  logicApps: LogicApp[];
}

export async function listLogicApps(
  subscriptionId: string,
  resourceGroupName?: string,
  sku: "consumption" | "standard" | "all" = "all"
): Promise<ListLogicAppsResult> {
  const logicApps: LogicApp[] = [];

  // Fetch Consumption Logic Apps
  if (sku === "consumption" || sku === "all") {
    const consumptionApps = await fetchConsumptionLogicApps(
      subscriptionId,
      resourceGroupName
    );
    logicApps.push(...consumptionApps);
  }

  // Fetch Standard Logic Apps
  if (sku === "standard" || sku === "all") {
    const standardApps = await fetchStandardLogicApps(
      subscriptionId,
      resourceGroupName
    );
    logicApps.push(...standardApps);
  }

  return { logicApps };
}

async function fetchConsumptionLogicApps(
  subscriptionId: string,
  resourceGroupName?: string
): Promise<LogicApp[]> {
  const basePath = resourceGroupName
    ? `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows`
    : `/subscriptions/${subscriptionId}/providers/Microsoft.Logic/workflows`;

  const workflows = await armRequestAllPages<ConsumptionLogicApp>(basePath, {
    "api-version": "2019-05-01",
  });

  return workflows.map((wf) => ({
    id: wf.id,
    name: wf.name,
    resourceGroup: extractResourceGroup(wf.id),
    location: wf.location,
    sku: "consumption" as const,
    state: wf.properties.state,
    createdTime: wf.properties.createdTime,
    changedTime: wf.properties.changedTime,
    tags: wf.tags,
  }));
}

async function fetchStandardLogicApps(
  subscriptionId: string,
  resourceGroupName?: string
): Promise<LogicApp[]> {
  const basePath = resourceGroupName
    ? `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites`
    : `/subscriptions/${subscriptionId}/providers/Microsoft.Web/sites`;

  const sites = await armRequestAllPages<StandardLogicApp>(basePath, {
    "api-version": "2023-01-01",
  });

  // Filter to only workflow apps
  const workflowApps = sites.filter((site) =>
    site.kind?.toLowerCase().includes("workflowapp")
  );

  return workflowApps.map((app) => ({
    id: app.id,
    name: app.name,
    resourceGroup: extractResourceGroup(app.id),
    location: app.location,
    sku: "standard" as const,
    state: app.properties.state,
    tags: app.tags,
  }));
}
