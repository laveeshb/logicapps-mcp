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
  describe("schema validation", () => {
    it("should validate listSubscriptionsSchema accepts empty object", () => {
      expect(() => listSubscriptionsSchema.parse({})).not.toThrow();
    });

    it("should validate listLogicAppsSchema requires subscriptionId and validates sku enum", () => {
      expect(() => listLogicAppsSchema.parse({})).toThrow(ZodError);
      
      const result = listLogicAppsSchema.parse({ subscriptionId: "abc-123", resourceGroupName: "myRG" });
      expect(result.subscriptionId).toBe("abc-123");
      expect(result.resourceGroupName).toBe("myRG");
      
      expect(() => listLogicAppsSchema.parse({ subscriptionId: "abc-123", sku: "invalid" })).toThrow(ZodError);
      expect(listLogicAppsSchema.parse({ subscriptionId: "abc-123", sku: "standard" }).sku).toBe("standard");
    });

    it("should validate listWorkflowsSchema requires all fields", () => {
      expect(() => listWorkflowsSchema.parse({})).toThrow(ZodError);
      expect(() => listWorkflowsSchema.parse({ subscriptionId: "abc" })).toThrow(ZodError);
      expect(() => listWorkflowsSchema.parse({ subscriptionId: "abc", resourceGroupName: "rg" })).toThrow(ZodError);
      
      const result = listWorkflowsSchema.parse({ subscriptionId: "abc", resourceGroupName: "rg", logicAppName: "app" });
      expect(result.logicAppName).toBe("app");
    });

    it("should validate getRunDetailsSchema requires runId with clear error message", () => {
      const result = getRunDetailsSchema.safeParse({ subscriptionId: "abc", resourceGroupName: "rg", logicAppName: "app" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const runIdError = result.error.issues.find((err) => err.path[0] === "runId");
        expect(runIdError).toBeDefined();
        expect(runIdError?.message).toContain("expected string");
      }
      
      const valid = getRunDetailsSchema.parse({ subscriptionId: "abc", resourceGroupName: "rg", logicAppName: "app", runId: "run123", workflowName: "workflow1" });
      expect(valid.workflowName).toBe("workflow1");
    });

    it("should validate getTriggerHistorySchema requires triggerName and validates top range", () => {
      expect(() => getTriggerHistorySchema.parse({ subscriptionId: "abc", resourceGroupName: "rg", logicAppName: "app" })).toThrow(ZodError);
      expect(() => getTriggerHistorySchema.parse({ subscriptionId: "abc", resourceGroupName: "rg", logicAppName: "app", triggerName: "t1", top: 0 })).toThrow(ZodError);
      expect(() => getTriggerHistorySchema.parse({ subscriptionId: "abc", resourceGroupName: "rg", logicAppName: "app", triggerName: "t1", top: 101 })).toThrow(ZodError);
      
      const result = getTriggerHistorySchema.parse({ subscriptionId: "abc", resourceGroupName: "rg", logicAppName: "app", triggerName: "t1", top: 50 });
      expect(result.top).toBe(50);
    });

    it("should validate searchRunsSchema validates status enum", () => {
      expect(() => searchRunsSchema.parse({ subscriptionId: "abc", resourceGroupName: "rg", logicAppName: "app", status: "Invalid" })).toThrow(ZodError);
      expect(searchRunsSchema.parse({ subscriptionId: "abc", resourceGroupName: "rg", logicAppName: "app", status: "Failed" }).status).toBe("Failed");
    });

    it("should validate createWorkflowSchema requires definition and validates kind enum", () => {
      expect(() => createWorkflowSchema.parse({ subscriptionId: "abc", resourceGroupName: "rg", logicAppName: "app" })).toThrow(ZodError);
      
      const result = createWorkflowSchema.parse({ subscriptionId: "abc", resourceGroupName: "rg", logicAppName: "app", definition: { actions: {} } });
      expect(result.definition).toEqual({ actions: {} });
      
      expect(() => createWorkflowSchema.parse({ subscriptionId: "abc", resourceGroupName: "rg", logicAppName: "app", definition: {}, kind: "Invalid" })).toThrow(ZodError);
      expect(createWorkflowSchema.parse({ subscriptionId: "abc", resourceGroupName: "rg", logicAppName: "app", definition: {}, kind: "Stateless" }).kind).toBe("Stateless");
    });

    it("should validate getTroubleshootingGuideSchema validates topic enum", () => {
      expect(() => getTroubleshootingGuideSchema.parse({ topic: "invalid" })).toThrow(ZodError);
      expect(getTroubleshootingGuideSchema.parse({ topic: "run-failures" }).topic).toBe("run-failures");
    });
  });

  describe("TOOL_SCHEMAS registry", () => {
    it("should have schema objects for all tools", () => {
      expect(Object.keys(TOOL_SCHEMAS).length).toBeGreaterThan(30);
      
      // Verify some key tools have schemas
      const keyTools = ["list_subscriptions", "list_logic_apps", "get_workflow_definition", "create_workflow"];
      for (const tool of keyTools) {
        expect(TOOL_SCHEMAS[tool], `${tool} should have a schema`).toBeDefined();
        expect(typeof TOOL_SCHEMAS[tool].parse).toBe("function");
      }
    });

    it("should return valid parsed results or throw ZodError", () => {
      // Test a valid call
      const listResult = TOOL_SCHEMAS["list_logic_apps"].parse({ subscriptionId: "test-sub" });
      expect(listResult.subscriptionId).toBe("test-sub");
      
      // Test an invalid call
      expect(() => TOOL_SCHEMAS["list_logic_apps"].parse({})).toThrow(ZodError);
    });
  });
});
