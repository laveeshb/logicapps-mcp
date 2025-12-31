/**
 * Integration tests for connection operations.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { discoverTestResources, TestResources } from "./setup.js";
import { getConnections, getConnectionDetails, testConnection } from "../tools/connections.js";

describe("connections integration", () => {
  let resources: TestResources | null;

  beforeAll(async () => {
    resources = await discoverTestResources();
  });

  it("should list connections", async () => {
    if (!resources) return;

    const result = await getConnections(resources.subscriptionId, resources.resourceGroup);

    expect(result).toBeDefined();
    expect(result.connections).toBeInstanceOf(Array);

    if (result.connections.length > 0) {
      const conn = result.connections[0];
      expect(conn.name).toBeDefined();
      expect(conn.apiName).toBeDefined();
    }
  });

  it("should get connection details", async () => {
    if (!resources?.connectionName) return;

    const result = await getConnectionDetails(
      resources.subscriptionId,
      resources.resourceGroup,
      resources.connectionName
    );

    expect(result).toBeDefined();
    expect(result.name).toBe(resources.connectionName);
    expect(result.api).toBeDefined();
  });

  it("should test connection", async () => {
    if (!resources?.connectionName) return;

    const result = await testConnection(
      resources.subscriptionId,
      resources.resourceGroup,
      resources.connectionName
    );

    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
  });
});
