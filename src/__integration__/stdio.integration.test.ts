/**
 * Integration test for the local stdio server.
 *
 * Starts the built server (dist/index.js) as a child process, the way an MCP
 * client does, and calls a tool. The server has to get its own token from the
 * Azure CLI login. The other integration tests set the token themselves, so
 * they do not cover this path (#138).
 *
 * Requires `npm run build` and `az login`. Unlike the other integration
 * tests, this one fails instead of passing quietly when something is missing.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverEntry = fileURLToPath(new URL("../../dist/index.js", import.meta.url));

describe("stdio server integration", () => {
  let client: Client;

  beforeAll(async () => {
    if (!existsSync(serverEntry)) {
      throw new Error(`${serverEntry} not found. Run 'npm run build' first.`);
    }

    client = new Client({ name: "integration-test", version: "0.0.0" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [serverEntry],
        env: process.env as Record<string, string>,
      })
    );
  });

  afterAll(async () => {
    await client?.close();
  });

  async function listSubscriptionsViaServer(): Promise<{ subscriptions: unknown[] }> {
    const result = await client.callTool({ name: "list_subscriptions", arguments: {} });
    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0]?.text ?? "";

    // On failure the server returns the error as text, so show it in the assertion.
    expect(result.isError, text).toBeFalsy();
    return JSON.parse(text) as { subscriptions: unknown[] };
  }

  it("uses the Azure CLI login without a token from the client", async () => {
    const result = await listSubscriptionsViaServer();

    expect(result.subscriptions.length).toBeGreaterThan(0);
  });

  it("a second call also succeeds", async () => {
    const result = await listSubscriptionsViaServer();

    expect(result.subscriptions.length).toBeGreaterThan(0);
  });
});
