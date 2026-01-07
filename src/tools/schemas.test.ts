/**
 * Tests for Zod validation schemas.
 */

import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  listSubscriptionsSchema,
  listLogicAppsSchema,
  listWorkflowsSchema,
  getRunDetailsSchema,
  getTriggerHistorySchema,
  createWorkflowSchema,
  searchRunsSchema,
  getTroubleshootingGuideSchema,
  TOOL_SCHEMAS,
} from "./schemas.js";

describe("Zod Schemas", () => {
  describe("listSubscriptionsSchema", () => {
    it("should accept empty object", () => {
      expect(() => listSubscriptionsSchema.parse({})).not.toThrow();
    });
  });

  describe("listLogicAppsSchema", () => {
    it("should require subscriptionId", () => {
      expect(() => listLogicAppsSchema.parse({})).toThrow(ZodError);
    });

    it("should accept valid subscriptionId", () => {
      const result = listLogicAppsSchema.parse({ subscriptionId: "abc-123" });
      expect(result.subscriptionId).toBe("abc-123");
    });

    it("should accept optional resourceGroupName", () => {
      const result = listLogicAppsSchema.parse({
        subscriptionId: "abc-123",
        resourceGroupName: "myRG",
      });
      expect(result.resourceGroupName).toBe("myRG");
    });

    it("should validate sku enum", () => {
      expect(() =>
        listLogicAppsSchema.parse({
          subscriptionId: "abc-123",
          sku: "invalid",
        })
      ).toThrow(ZodError);

      const result = listLogicAppsSchema.parse({
        subscriptionId: "abc-123",
        sku: "standard",
      });
      expect(result.sku).toBe("standard");
    });
  });

  describe("listWorkflowsSchema", () => {
    it("should require all fields", () => {
      expect(() => listWorkflowsSchema.parse({})).toThrow(ZodError);
      expect(() =>
        listWorkflowsSchema.parse({ subscriptionId: "abc" })
      ).toThrow(ZodError);
      expect(() =>
        listWorkflowsSchema.parse({ subscriptionId: "abc", resourceGroupName: "rg" })
      ).toThrow(ZodError);
    });

    it("should accept valid input", () => {
      const result = listWorkflowsSchema.parse({
        subscriptionId: "abc-123",
        resourceGroupName: "myRG",
        logicAppName: "myApp",
      });
      expect(result.logicAppName).toBe("myApp");
    });
  });

  describe("getRunDetailsSchema", () => {
    it("should require runId", () => {
      expect(() =>
        getRunDetailsSchema.parse({
          subscriptionId: "abc",
          resourceGroupName: "rg",
          logicAppName: "app",
        })
      ).toThrow(ZodError);
    });

    it("should provide clear error message for missing runId", () => {
      const result = getRunDetailsSchema.safeParse({
        subscriptionId: "abc",
        resourceGroupName: "rg",
        logicAppName: "app",
      });
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        const runIdError = result.error.issues.find((err) => 
          err.path[0] === "runId"
        );
        expect(runIdError).toBeDefined();
        // Zod v4 uses a different message format for missing required fields
        expect(runIdError?.message).toContain("expected string");
      }
    });

    it("should accept optional workflowName", () => {
      const result = getRunDetailsSchema.parse({
        subscriptionId: "abc",
        resourceGroupName: "rg",
        logicAppName: "app",
        runId: "run123",
        workflowName: "workflow1",
      });
      expect(result.workflowName).toBe("workflow1");
    });
  });

  describe("getTriggerHistorySchema", () => {
    it("should require triggerName", () => {
      expect(() =>
        getTriggerHistorySchema.parse({
          subscriptionId: "abc",
          resourceGroupName: "rg",
          logicAppName: "app",
        })
      ).toThrow(ZodError);
    });

    it("should validate top range", () => {
      expect(() =>
        getTriggerHistorySchema.parse({
          subscriptionId: "abc",
          resourceGroupName: "rg",
          logicAppName: "app",
          triggerName: "trigger1",
          top: 0,
        })
      ).toThrow(ZodError);

      expect(() =>
        getTriggerHistorySchema.parse({
          subscriptionId: "abc",
          resourceGroupName: "rg",
          logicAppName: "app",
          triggerName: "trigger1",
          top: 101,
        })
      ).toThrow(ZodError);

      const result = getTriggerHistorySchema.parse({
        subscriptionId: "abc",
        resourceGroupName: "rg",
        logicAppName: "app",
        triggerName: "trigger1",
        top: 50,
      });
      expect(result.top).toBe(50);
    });
  });

  describe("searchRunsSchema", () => {
    it("should validate status enum", () => {
      expect(() =>
        searchRunsSchema.parse({
          subscriptionId: "abc",
          resourceGroupName: "rg",
          logicAppName: "app",
          status: "Invalid",
        })
      ).toThrow(ZodError);

      const result = searchRunsSchema.parse({
        subscriptionId: "abc",
        resourceGroupName: "rg",
        logicAppName: "app",
        status: "Failed",
      });
      expect(result.status).toBe("Failed");
    });
  });

  describe("createWorkflowSchema", () => {
    it("should require definition", () => {
      expect(() =>
        createWorkflowSchema.parse({
          subscriptionId: "abc",
          resourceGroupName: "rg",
          logicAppName: "app",
        })
      ).toThrow(ZodError);
    });

    it("should accept workflow definition object", () => {
      const result = createWorkflowSchema.parse({
        subscriptionId: "abc",
        resourceGroupName: "rg",
        logicAppName: "app",
        definition: {
          $schema: "https://schema.management.azure.com/schemas/2016-06-01/workflowdefinition.json#",
          triggers: {},
          actions: {},
        },
      });
      expect(result.definition).toBeDefined();
    });

    it("should validate kind enum", () => {
      expect(() =>
        createWorkflowSchema.parse({
          subscriptionId: "abc",
          resourceGroupName: "rg",
          logicAppName: "app",
          definition: {},
          kind: "Invalid",
        })
      ).toThrow(ZodError);
    });
  });

  describe("getTroubleshootingGuideSchema", () => {
    it("should require topic", () => {
      expect(() => getTroubleshootingGuideSchema.parse({})).toThrow(ZodError);
    });

    it("should validate topic enum", () => {
      expect(() =>
        getTroubleshootingGuideSchema.parse({ topic: "invalid-topic" })
      ).toThrow(ZodError);

      const result = getTroubleshootingGuideSchema.parse({
        topic: "expression-errors",
      });
      expect(result.topic).toBe("expression-errors");
    });
  });

  describe("TOOL_SCHEMAS registry", () => {
    it("should have schemas for all expected tools", () => {
      const expectedTools = [
        "list_subscriptions",
        "list_logic_apps",
        "list_workflows",
        "get_workflow_definition",
        "get_run_details",
        "get_run_actions",
        "search_runs",
        "get_connections",
        "create_workflow",
        "update_workflow",
        "delete_workflow",
        "get_troubleshooting_guide",
      ];

      for (const tool of expectedTools) {
        expect(TOOL_SCHEMAS[tool]).toBeDefined();
      }
    });

    it("should have 39 tools registered", () => {
      // 39 tools total in the handler
      expect(Object.keys(TOOL_SCHEMAS).length).toBe(39);
    });
  });
});
