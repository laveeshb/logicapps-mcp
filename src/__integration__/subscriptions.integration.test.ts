/**
 * Integration tests for subscription operations.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { discoverTestResources, TestResources } from "./setup.js";
import { listSubscriptions } from "../tools/subscriptions.js";

describe("subscriptions integration", () => {
  let resources: TestResources | null;

  beforeAll(async () => {
    resources = await discoverTestResources();
  });

  it("should list subscriptions", async () => {
    if (!resources) return;

    const result = await listSubscriptions();

    expect(result).toBeDefined();
    expect(result.subscriptions).toBeInstanceOf(Array);
    expect(result.subscriptions.length).toBeGreaterThan(0);

    // Verify the discovered subscription is in the list
    const testSub = result.subscriptions.find((s) => s.subscriptionId === resources!.subscriptionId);
    expect(testSub).toBeDefined();
    expect(testSub?.displayName).toBeDefined();
  });
});
