/**
 * Integration tests for workflow operations.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { discoverTestResources, TestResources } from "./setup.js";
import { listLogicApps } from "../tools/logicApps.js";
import {
  listWorkflows,
  getWorkflowDefinition,
  getWorkflowTriggers,
  listWorkflowVersions,
} from "../tools/workflows.js";

describe("workflows integration", () => {
  let resources: TestResources | null;

  beforeAll(async () => {
    resources = await discoverTestResources();
  });

  describe("Standard Logic App", () => {
    it("should list workflows", async () => {
      if (!resources?.standardLogicApp) return;

      // Get resource group for this Logic App
      const apps = await listLogicApps(resources.subscriptionId);
      const app = apps.logicApps.find((a) => a.name === resources!.standardLogicApp!.name);
      if (!app) return;
      const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

      const result = await listWorkflows(resources.subscriptionId, rg, resources.standardLogicApp.name);

      expect(result).toBeDefined();
      expect(result.workflows).toBeInstanceOf(Array);

      // Only check structure if workflows exist
      if (result.workflows.length > 0) {
        for (const workflow of result.workflows) {
          expect(workflow.name).toBeDefined();
          expect(workflow.state).toBeDefined();
        }
      }
    });

    it("should get workflow definition", async () => {
      if (!resources?.standardLogicApp?.workflowName) return;

      const apps = await listLogicApps(resources.subscriptionId);
      const app = apps.logicApps.find((a) => a.name === resources!.standardLogicApp!.name);
      if (!app) return;
      const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

      const result = await getWorkflowDefinition(
        resources.subscriptionId,
        rg,
        resources.standardLogicApp.name,
        resources.standardLogicApp.workflowName
      );

      expect(result).toBeDefined();
      expect(result.definition).toBeDefined();
      expect(result.definition.$schema).toBeDefined();
      expect(result.definition.triggers).toBeDefined();
      expect(result.definition.actions).toBeDefined();
    });

    it("should get workflow triggers", async () => {
      if (!resources?.standardLogicApp?.workflowName) return;

      const apps = await listLogicApps(resources.subscriptionId);
      const app = apps.logicApps.find((a) => a.name === resources!.standardLogicApp!.name);
      if (!app) return;
      const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

      const result = await getWorkflowTriggers(
        resources.subscriptionId,
        rg,
        resources.standardLogicApp.name,
        resources.standardLogicApp.workflowName
      );

      expect(result).toBeDefined();
      expect(result.triggers).toBeInstanceOf(Array);
    });

    it("should list workflow versions", async () => {
      // listWorkflowVersions only works for Consumption Logic Apps
      if (!resources?.consumptionLogicApp) return;

      const apps = await listLogicApps(resources.subscriptionId);
      const app = apps.logicApps.find((a) => a.name === resources!.consumptionLogicApp!.name);
      if (!app) return;
      const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

      const result = await listWorkflowVersions(
        resources.subscriptionId,
        rg,
        resources.consumptionLogicApp.name
      );

      expect(result).toBeDefined();
      expect(result.versions).toBeInstanceOf(Array);
    });
  });

  describe("Consumption Logic App", () => {
    it("should get workflow definition", async () => {
      if (!resources?.consumptionLogicApp) return;

      const apps = await listLogicApps(resources.subscriptionId);
      const app = apps.logicApps.find((a) => a.name === resources!.consumptionLogicApp!.name);
      if (!app) return;
      const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

      const result = await getWorkflowDefinition(
        resources.subscriptionId,
        rg,
        resources.consumptionLogicApp.name
      );

      expect(result).toBeDefined();
      expect(result.definition).toBeDefined();
      expect(result.definition.$schema).toBeDefined();
    });

    it("should get workflow triggers", async () => {
      if (!resources?.consumptionLogicApp) return;

      const apps = await listLogicApps(resources.subscriptionId);
      const app = apps.logicApps.find((a) => a.name === resources!.consumptionLogicApp!.name);
      if (!app) return;
      const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

      const result = await getWorkflowTriggers(
        resources.subscriptionId,
        rg,
        resources.consumptionLogicApp.name
      );

      expect(result).toBeDefined();
      expect(result.triggers).toBeInstanceOf(Array);
    });
  });
});
