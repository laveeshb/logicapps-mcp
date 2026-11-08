/**
 * Checks that the standalone HTTP server passes the read-only setting to the
 * tools it lists and runs.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock("../config/index.js");
});

interface McpReply {
  result: {
    tools: Array<{ name: string }>;
    isError?: boolean;
    content: Array<{ text: string }>;
  };
}

async function post(readOnly: boolean, body: unknown): Promise<McpReply> {
  // The module keeps its settings after the first request, so load a fresh copy.
  vi.resetModules();
  vi.doMock("../config/index.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../config/index.js")>()),
    loadSettings: async () => ({
      tenantId: "common",
      clientId: "client",
      cloud: (await import("../config/clouds.js")).getCloudEndpoints("AzurePublic"),
      logLevel: "info",
      cacheTtlSeconds: 300,
      readOnly,
    }),
  }));

  const { createMcpApp } = await import("./index.js");
  server = createMcpApp().listen(0);
  const { port } = server.address() as AddressInfo;

  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...(body as object) }),
  });
  const text = await response.text();
  const data = text.split("\n").find((line) => line.startsWith("data:"));
  return JSON.parse(data ? data.slice(5) : text);
}

const listTools = { method: "tools/list", params: {} };

describe("http server read-only mode", () => {
  it("does not list tools that change or run workflows", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = await post(true, listTools);
    const names = result.tools.map((t: { name: string }) => t.name);

    expect(names).toContain("list_run_history");
    expect(names).not.toContain("delete_workflow");
    expect(names).not.toContain("run_trigger");
  });

  it("lists every tool when read-only mode is off", async () => {
    const { result } = await post(false, listTools);
    const names = result.tools.map((t: { name: string }) => t.name);

    expect(names).toContain("delete_workflow");
    expect(names).toContain("run_trigger");
  });

  it("refuses a call to a hidden tool", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = await post(true, {
      method: "tools/call",
      params: { name: "delete_workflow", arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error.code).toBe("ReadOnlyMode");
  });

  it("logs that read-only mode is on", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await post(true, listTools);

    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^Read-only mode: \d+ of \d+ tools/));
  });
});
