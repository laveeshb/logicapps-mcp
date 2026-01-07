/**
 * List Logic Apps across both Consumption and Standard SKUs.
 */

import { armRequest } from "../utils/http.js";
import { ConsumptionLogicApp, StandardLogicApp, LogicApp } from "../types/logicApp.js";
import { extractResourceGroup } from "./shared.js";

export interface ListLogicAppsResult {
  logicApps: LogicApp[];
  consumptionNextLink?: string;
  standardNextLink?: string;
}

export async function listLogicApps(
  subscriptionId: string,
  resourceGroupName?: string,
  sku: "consumption" | "standard" | "all" = "all"
): Promise<ListLogicAppsResult> {
  const logicApps: LogicApp[] = [];
  let consumptionNextLink: string | undefined;
  let standardNextLink: string | undefined;

  // Fetch Consumption Logic Apps
  if (sku === "consumption" || sku === "all") {
    const result = await fetchConsumptionLogicApps(subscriptionId, resourceGroupName);
    logicApps.push(...result.apps);
    consumptionNextLink = result.nextLink;
  }

  // Fetch Standard Logic Apps
  if (sku === "standard" || sku === "all") {
    const result = await fetchStandardLogicApps(subscriptionId, resourceGroupName);
    logicApps.push(...result.apps);
    standardNextLink = result.nextLink;
  }

  return { logicApps, consumptionNextLink, standardNextLink };
}

async function fetchConsumptionLogicApps(
  subscriptionId: string,
  resourceGroupName?: string
): Promise<{ apps: LogicApp[]; nextLink?: string }> {
  const basePath = resourceGroupName
    ? `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Logic/workflows`
    : `/subscriptions/${subscriptionId}/providers/Microsoft.Logic/workflows`;

  const response = await armRequest<{ value: ConsumptionLogicApp[]; nextLink?: string }>(basePath, {
    queryParams: { "api-version": "2019-05-01" },
  });

  const workflows = response.value ?? [];

  return {
    apps: workflows.map((wf) => ({
      id: wf.id,
      name: wf.name,
      resourceGroup: extractResourceGroup(wf.id),
      location: wf.location,
      sku: "consumption" as const,
      state: wf.properties.state,
      createdTime: wf.properties.createdTime,
      changedTime: wf.properties.changedTime,
      tags: wf.tags,
    })),
    nextLink: response.nextLink,
  };
}

async function fetchStandardLogicApps(
  subscriptionId: string,
  resourceGroupName?: string
): Promise<{ apps: LogicApp[]; nextLink?: string }> {
  const basePath = resourceGroupName
    ? `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites`
    : `/subscriptions/${subscriptionId}/providers/Microsoft.Web/sites`;

  const response = await armRequest<{ value: StandardLogicApp[]; nextLink?: string }>(basePath, {
    queryParams: { "api-version": "2023-01-01" },
  });

  const sites = response.value ?? [];

  // Filter to only workflow apps
  const workflowApps = sites.filter((site) => site.kind?.toLowerCase().includes("workflowapp"));

  return {
    apps: workflowApps.map((app) => ({
      id: app.id,
      name: app.name,
      resourceGroup: extractResourceGroup(app.id),
      location: app.location,
      sku: "standard" as const,
      state: app.properties.state,
      tags: app.tags,
    })),
    nextLink: response.nextLink,
  };
}
