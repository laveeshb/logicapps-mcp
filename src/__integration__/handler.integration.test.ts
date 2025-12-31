/**
 * Integration tests for the MCP tool handler.
 * Tests the full tool call flow end-to-end.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { discoverTestResources, TestResources } from "./setup.js";
import { listLogicApps } from "../tools/logicApps.js";
import { handleToolCall } from "../tools/handler.js";

describe("handler integration", () => {
  let resources: TestResources | null;

  beforeAll(async () => {
    resources = await discoverTestResources();
  });

  it("should handle list_subscriptions", async () => {
    if (!resources) return;

    const result = await handleToolCall("list_subscriptions", {});

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");

    const content = result.content[0];
    const data = JSON.parse(content.type === "text" ? content.text : "");
    expect(data.subscriptions).toBeInstanceOf(Array);
    expect(data.subscriptions.length).toBeGreaterThan(0);
  });

  it("should handle list_logic_apps", async () => {
    if (!resources) return;

    const result = await handleToolCall("list_logic_apps", {
      subscriptionId: resources.subscriptionId,
      resourceGroupName: resources.resourceGroup,
    });

    expect(result.isError).toBeFalsy();

    const content = result.content[0];
    const data = JSON.parse(content.type === "text" ? content.text : "");
    expect(data.logicApps).toBeInstanceOf(Array);
  });

  it("should handle list_workflows for Standard", async () => {
    if (!resources?.standardLogicApp) return;

    const apps = await listLogicApps(resources.subscriptionId);
    const app = apps.logicApps.find((a) => a.name === resources!.standardLogicApp!.name);
    if (!app) return;
    const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

    const result = await handleToolCall("list_workflows", {
      subscriptionId: resources.subscriptionId,
      resourceGroupName: rg,
      logicAppName: resources.standardLogicApp.name,
    });

    expect(result.isError).toBeFalsy();

    const content = result.content[0];
    const data = JSON.parse(content.type === "text" ? content.text : "");
    expect(data.workflows).toBeInstanceOf(Array);
  });

  it("should handle get_workflow_definition for Consumption", async () => {
    if (!resources?.consumptionLogicApp) return;

    const apps = await listLogicApps(resources.subscriptionId);
    const app = apps.logicApps.find((a) => a.name === resources!.consumptionLogicApp!.name);
    if (!app) return;
    const rg = app.id.match(/resourceGroups\/([^/]+)/i)?.[1] || resources.resourceGroup;

    const result = await handleToolCall("get_workflow_definition", {
      subscriptionId: resources.subscriptionId,
      resourceGroupName: rg,
      logicAppName: resources.consumptionLogicApp.name,
    });

    expect(result.isError).toBeFalsy();

    const content = result.content[0];
    const data = JSON.parse(content.type === "text" ? content.text : "");
    expect(data.definition).toBeDefined();
    expect(data.definition.$schema).toBeDefined();
  });

  it("should handle get_connections", async () => {
    if (!resources) return;

    const result = await handleToolCall("get_connections", {
      subscriptionId: resources.subscriptionId,
      resourceGroupName: resources.resourceGroup,
    });

    expect(result.isError).toBeFalsy();

    const content = result.content[0];
    const data = JSON.parse(content.type === "text" ? content.text : "");
    expect(data.connections).toBeInstanceOf(Array);
  });

  it("should return error for unknown tool", async () => {
    if (!resources) return;

    const result = await handleToolCall("unknown_tool", {});

    expect(result.isError).toBe(true);
  });

  describe("knowledge tools", () => {
    it("should handle get_troubleshooting_guide", async () => {
      if (!resources) return;

      const result = await handleToolCall("get_troubleshooting_guide", {
        topic: "expression-errors",
      });

      expect(result.isError).toBeFalsy();

      const content = result.content[0];
      const data = JSON.parse(content.type === "text" ? content.text : "");
      expect(data.topic).toBe("expression-errors");
      expect(data.content).toBeDefined();
    });

    it("should handle get_workflow_instructions", async () => {
      if (!resources) return;

      const result = await handleToolCall("get_workflow_instructions", {
        topic: "diagnose-failures",
      });

      expect(result.isError).toBeFalsy();

      const content = result.content[0];
      const data = JSON.parse(content.type === "text" ? content.text : "");
      expect(data.topic).toBe("diagnose-failures");
      expect(data.content).toBeDefined();
    });
  });
});
