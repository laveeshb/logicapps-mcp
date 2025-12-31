/**
 * Integration tests for Logic Apps operations.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { discoverTestResources, TestResources } from "./setup.js";
import { listLogicApps } from "../tools/logicApps.js";

describe("logic apps integration", () => {
  let resources: TestResources | null;

  beforeAll(async () => {
    resources = await discoverTestResources();
  });

  it("should list all Logic Apps in subscription", async () => {
    if (!resources) return;

    const result = await listLogicApps(resources.subscriptionId);

    expect(result).toBeDefined();
    expect(result.logicApps).toBeInstanceOf(Array);
    expect(result.logicApps.length).toBeGreaterThan(0);
  });

  it("should list Logic Apps in resource group", async () => {
    if (!resources) return;

    const result = await listLogicApps(resources.subscriptionId, resources.resourceGroup);

    expect(result).toBeDefined();
    expect(result.logicApps).toBeInstanceOf(Array);
  });

  it("should filter Logic Apps by Standard SKU", async () => {
    if (!resources || !resources.standardLogicApp) return;

    const result = await listLogicApps(resources.subscriptionId, undefined, "standard");

    expect(result).toBeDefined();
    expect(result.logicApps).toBeInstanceOf(Array);

    // All returned apps should be Standard
    for (const app of result.logicApps) {
      expect(app.sku).toBe("standard");
    }
  });

  it("should filter Logic Apps by Consumption SKU", async () => {
    if (!resources || !resources.consumptionLogicApp) return;

    const result = await listLogicApps(resources.subscriptionId, undefined, "consumption");

    expect(result).toBeDefined();
    expect(result.logicApps).toBeInstanceOf(Array);

    // All returned apps should be Consumption
    for (const app of result.logicApps) {
      expect(app.sku).toBe("consumption");
    }
  });
});
