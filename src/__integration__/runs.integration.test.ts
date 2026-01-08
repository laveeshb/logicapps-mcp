/**
 * Integration tests for run history operations.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { discoverTestResources, TestResources } from "./setup.js";
import { listLogicApps } from "../tools/logicApps.js";
import { listRunHistory, getRunDetails, getRunActions, searchRuns, resubmitRun } from "../tools/runs.js";

describe("runs integration", () => {
  let resources: TestResources | null;

  beforeAll(async () => {
    resources = await discoverTestResources();
  });

  describe("Standard Logic App", () => {
    it("should list run history", async () => {
      if (!resources?.standardLogicApp?.workflowName) return;

      const apps = await listLogicApps(resources.subscriptionId);
      const app = apps.logicApps.find((a) => a.name === resources!.standardLogicApp!.name);
      if (!app) return;
      const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

      const result = await listRunHistory(
        resources.subscriptionId,
        rg,
        resources.standardLogicApp.name,
        resources.standardLogicApp.workflowName,
        5
      );

      expect(result).toBeDefined();
      expect(result.runs).toBeInstanceOf(Array);

      if (result.runs.length > 0) {
        const run = result.runs[0];
        expect(run.name).toBeDefined();
        expect(run.status).toBeDefined();
        expect(run.startTime).toBeDefined();
      }
    });

    it("should get run details", async () => {
      if (!resources?.standardLogicApp?.workflowName) return;

      const apps = await listLogicApps(resources.subscriptionId);
      const app = apps.logicApps.find((a) => a.name === resources!.standardLogicApp!.name);
      if (!app) return;
      const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

      // Get a run first
      const runs = await listRunHistory(
        resources.subscriptionId,
        rg,
        resources.standardLogicApp.name,
        resources.standardLogicApp.workflowName,
        1
      );
      if (runs.runs.length === 0) return;

      const runId = runs.runs[0].name;
      const result = await getRunDetails(
        resources.subscriptionId,
        rg,
        resources.standardLogicApp.name,
        runId,
        resources.standardLogicApp.workflowName
      );

      expect(result).toBeDefined();
      expect(result.run.name).toBe(runId);
      expect(result.run.status).toBeDefined();
    });

    it("should get run actions", async () => {
      if (!resources?.standardLogicApp?.workflowName) return;

      const apps = await listLogicApps(resources.subscriptionId);
      const app = apps.logicApps.find((a) => a.name === resources!.standardLogicApp!.name);
      if (!app) return;
      const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

      // Get a run first
      const runs = await listRunHistory(
        resources.subscriptionId,
        rg,
        resources.standardLogicApp.name,
        resources.standardLogicApp.workflowName,
        1
      );
      if (runs.runs.length === 0) return;

      const runId = runs.runs[0].name;
      const result = await getRunActions(
        resources.subscriptionId,
        rg,
        resources.standardLogicApp.name,
        runId,
        resources.standardLogicApp.workflowName
      );

      expect(result).toBeDefined();
      expect(result.actions).toBeInstanceOf(Array);
    });

    it("should search runs", async () => {
      if (!resources?.standardLogicApp?.workflowName) return;

      const apps = await listLogicApps(resources.subscriptionId);
      const app = apps.logicApps.find((a) => a.name === resources!.standardLogicApp!.name);
      if (!app) return;
      const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

      const result = await searchRuns(
        resources.subscriptionId,
        rg,
        resources.standardLogicApp.name,
        resources.standardLogicApp.workflowName,
        undefined, // any status
        undefined,
        undefined,
        undefined,
        5
      );

      expect(result).toBeDefined();
      expect(result.runs).toBeInstanceOf(Array);
    });
  });

  describe("Consumption Logic App", () => {
    it("should list run history", async () => {
      if (!resources?.consumptionLogicApp) return;

      const apps = await listLogicApps(resources.subscriptionId);
      const app = apps.logicApps.find((a) => a.name === resources!.consumptionLogicApp!.name);
      if (!app) return;
      const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

      const result = await listRunHistory(
        resources.subscriptionId,
        rg,
        resources.consumptionLogicApp.name,
        undefined,
        5
      );

      expect(result).toBeDefined();
      expect(result.runs).toBeInstanceOf(Array);
    });

    it("should get run details", async () => {
      if (!resources?.consumptionLogicApp) return;

      const apps = await listLogicApps(resources.subscriptionId);
      const app = apps.logicApps.find((a) => a.name === resources!.consumptionLogicApp!.name);
      if (!app) return;
      const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

      // Get a run first
      const runs = await listRunHistory(
        resources.subscriptionId,
        rg,
        resources.consumptionLogicApp.name,
        undefined,
        1
      );
      if (runs.runs.length === 0) return;

      const runId = runs.runs[0].name;
      const result = await getRunDetails(
        resources.subscriptionId,
        rg,
        resources.consumptionLogicApp.name,
        runId
      );

      expect(result).toBeDefined();
      expect(result.run.name).toBe(runId);
    });
  });

  describe("resubmitRun", () => {
    describe("Standard Logic App", () => {
      it("should resubmit a completed run", async () => {
        if (!resources?.standardLogicApp?.workflowName) return;

        const apps = await listLogicApps(resources.subscriptionId);
        const app = apps.logicApps.find((a) => a.name === resources!.standardLogicApp!.name);
        if (!app) return;
        const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

        // Find a succeeded run to resubmit
        const runs = await searchRuns(
          resources.subscriptionId,
          rg,
          resources.standardLogicApp.name,
          resources.standardLogicApp.workflowName,
          "Succeeded",
          undefined,
          undefined,
          undefined,
          5
        );

        if (runs.runs.length === 0) {
          console.log("No succeeded runs to resubmit, skipping test");
          return;
        }

        const runId = runs.runs[0].name;
        const result = await resubmitRun(
          resources.subscriptionId,
          rg,
          resources.standardLogicApp.name,
          runId,
          resources.standardLogicApp.workflowName
        );

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.originalRunId).toBe(runId);
        expect(result.message).toContain("resubmitted");
        expect(result.message).toContain(resources.standardLogicApp.workflowName);
      });

      it("should fail when workflowName is missing for Standard", async () => {
        if (!resources?.standardLogicApp?.workflowName) return;

        const apps = await listLogicApps(resources.subscriptionId);
        const app = apps.logicApps.find((a) => a.name === resources!.standardLogicApp!.name);
        if (!app) return;
        const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

        // Get any run
        const runs = await listRunHistory(
          resources.subscriptionId,
          rg,
          resources.standardLogicApp.name,
          resources.standardLogicApp.workflowName,
          1
        );
        if (runs.runs.length === 0) return;

        const runId = runs.runs[0].name;

        await expect(
          resubmitRun(resources.subscriptionId, rg, resources.standardLogicApp.name, runId)
        ).rejects.toThrow("workflowName is required for Standard Logic Apps");
      });
    });

    describe("Consumption Logic App", () => {
      it("should resubmit a completed run", async () => {
        if (!resources?.consumptionLogicApp) return;

        const apps = await listLogicApps(resources.subscriptionId);
        const app = apps.logicApps.find((a) => a.name === resources!.consumptionLogicApp!.name);
        if (!app) return;
        const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

        // Find a succeeded run to resubmit
        const runs = await searchRuns(
          resources.subscriptionId,
          rg,
          resources.consumptionLogicApp.name,
          undefined,
          "Succeeded",
          undefined,
          undefined,
          undefined,
          5
        );

        if (runs.runs.length === 0) {
          console.log("No succeeded runs to resubmit, skipping test");
          return;
        }

        const runId = runs.runs[0].name;
        const result = await resubmitRun(
          resources.subscriptionId,
          rg,
          resources.consumptionLogicApp.name,
          runId
        );

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.originalRunId).toBe(runId);
        expect(result.message).toContain("resubmitted");
        expect(result.message).toContain(resources.consumptionLogicApp.name);
      });
    });
  });
});
