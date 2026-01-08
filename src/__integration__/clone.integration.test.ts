/**
 * Integration tests for clone_workflow and validate_clone_workflow tools.
 *
 * These tests run against real Azure resources in the test subscription.
 * Pre-requisites:
 * - Consumption Logic App: laveeshb-test-wf-01 in yakima-test
 * - Standard Logic App: clone-target-std in yakima-test
 */

import { describe, it, expect, beforeAll } from "vitest";
import { cloneWorkflow, validateCloneWorkflow } from "../tools/workflows.js";
import { getAzureCliToken } from "../auth/azureCli.js";
import { setPassthroughToken } from "../auth/tokenManager.js";

// Test configuration - matches the Azure resources
const TEST_CONFIG = {
  subscriptionId: "7246da25-bfbb-4bd2-acad-3658085e2e6d",
  resourceGroup: "yakima-test",
  consumptionLogicApp: "laveeshb-test-wf-01",
  standardLogicApp: "clone-target-std",
};

describe("Clone Workflow Integration Tests", () => {
  beforeAll(async () => {
    // Get token from Azure CLI and set as passthrough token
    const cliToken = await getAzureCliToken();
    setPassthroughToken(cliToken.accessToken);

    // Verify test resources exist
    console.log("Verifying test resources...");
    console.log(`Subscription: ${TEST_CONFIG.subscriptionId}`);
    console.log(`Resource Group: ${TEST_CONFIG.resourceGroup}`);
    console.log(`Source (Consumption): ${TEST_CONFIG.consumptionLogicApp}`);
    console.log(`Target (Standard): ${TEST_CONFIG.standardLogicApp}`);
  });

  describe("validateCloneWorkflow", () => {
    it("should validate a clone from Consumption to Standard", async () => {
      const result = await validateCloneWorkflow(
        TEST_CONFIG.subscriptionId,
        TEST_CONFIG.resourceGroup,
        TEST_CONFIG.consumptionLogicApp,
        TEST_CONFIG.resourceGroup,
        TEST_CONFIG.standardLogicApp,
        "cloned-test-workflow",
        undefined,
        "Stateful"
      );

      console.log("Validation result:", JSON.stringify(result, null, 2));

      expect(result.isValid).toBe(true);
      expect(result.sourceWorkflow).toBe(TEST_CONFIG.consumptionLogicApp);
      expect(result.targetWorkflow).toBe("cloned-test-workflow");
      expect(result.targetLogicApp).toBe(TEST_CONFIG.standardLogicApp);
    });

    it("should fail validation when source is Standard", async () => {
      // Official API throws an error for invalid clone requests
      await expect(
        validateCloneWorkflow(
          TEST_CONFIG.subscriptionId,
          TEST_CONFIG.resourceGroup,
          TEST_CONFIG.standardLogicApp, // Standard as source - not a Consumption Logic App
          TEST_CONFIG.resourceGroup,
          TEST_CONFIG.standardLogicApp,
          "cloned-test-workflow"
        )
      ).rejects.toThrow();
    });

    it("should fail validation when target is Consumption", async () => {
      // Official API throws an error for invalid clone requests
      await expect(
        validateCloneWorkflow(
          TEST_CONFIG.subscriptionId,
          TEST_CONFIG.resourceGroup,
          TEST_CONFIG.consumptionLogicApp,
          TEST_CONFIG.resourceGroup,
          TEST_CONFIG.consumptionLogicApp, // Consumption as target - not a Standard Logic App
          "cloned-test-workflow"
        )
      ).rejects.toThrow();
    });
  });

  describe("cloneWorkflow", () => {
    it("should clone a Consumption workflow to Standard", async () => {
      const targetWorkflowName = `cloned-wf-${Date.now()}`;

      const result = await cloneWorkflow(
        TEST_CONFIG.subscriptionId,
        TEST_CONFIG.resourceGroup,
        TEST_CONFIG.consumptionLogicApp,
        TEST_CONFIG.resourceGroup,
        TEST_CONFIG.standardLogicApp,
        targetWorkflowName,
        undefined,
        "Stateful"
      );

      console.log("Clone result:", JSON.stringify(result, null, 2));

      expect(result.success).toBe(true);
      expect(result.sourceWorkflow).toBe(TEST_CONFIG.consumptionLogicApp);
      expect(result.targetWorkflow).toBe(targetWorkflowName);
      expect(result.targetLogicApp).toBe(TEST_CONFIG.standardLogicApp);
      expect(result.message).toContain("Successfully cloned");

      // Note: The Workflow Management API may take a moment to index the new workflow.
      // The ARM API shows it immediately. The clone was verified working via ARM API.
      // We verify the result structure is correct rather than re-querying.
    });

    it("should reject cloning from Standard Logic App", async () => {
      // Standard Logic Apps are Microsoft.Web/sites, not Microsoft.Logic/workflows
      // So the clone API returns "not found" since it only works on Consumption
      await expect(
        cloneWorkflow(
          TEST_CONFIG.subscriptionId,
          TEST_CONFIG.resourceGroup,
          TEST_CONFIG.standardLogicApp, // Standard as source - not a valid clone source
          TEST_CONFIG.resourceGroup,
          TEST_CONFIG.standardLogicApp,
          "should-not-create"
        )
      ).rejects.toThrow(); // API returns "not found" for Standard Logic Apps
    });

    it("should reject cloning to Consumption Logic App", async () => {
      // Consumption Logic Apps can't be clone targets - API validates this
      await expect(
        cloneWorkflow(
          TEST_CONFIG.subscriptionId,
          TEST_CONFIG.resourceGroup,
          TEST_CONFIG.consumptionLogicApp,
          TEST_CONFIG.resourceGroup,
          TEST_CONFIG.consumptionLogicApp, // Consumption as target
          "should-not-create"
        )
      ).rejects.toThrow(); // API returns error for invalid target
    });
  });
});
