/**
 * Integration test for read-only mode on the local stdio server.
 *
 * Starts the built server (dist/index.js) as a child process with --read-only
 * or LOGICAPPS_MCP_READ_ONLY set, and checks what a client sees. It does not
 * call Azure, so it needs no login, only `npm run build`. It fails instead of
 * passing quietly when the build is missing.
 */

import { describe, it, expect, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverEntry = fileURLToPath(new URL("../../dist/index.js", import.meta.url));

describe("read-only mode on the stdio server", () => {
  let client: Client | undefined;
  let stderrText = "";

  afterEach(async () => {
    await client?.close();
    client = undefined;
  });

  async function start(args: string[], env: Record<string, string> = {}): Promise<Client> {
    if (!existsSync(serverEntry)) {
      throw new Error(`${serverEntry} not found. Run 'npm run build' first.`);
    }
    const base = { ...process.env } as Record<string, string>;
    delete base.LOGICAPPS_MCP_READ_ONLY;

    stderrText = "";
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverEntry, ...args],
      env: { ...base, ...env },
      stderr: "pipe",
    });
    transport.stderr?.on("data", (chunk) => {
      stderrText += String(chunk);
    });

    client = new Client({ name: "integration-test", version: "0.0.0" });
    await client.connect(transport);
    return client;
  }

  async function toolNames(c: Client): Promise<string[]> {
    return (await c.listTools()).tools.map((t) => t.name);
  }

  it("lists every tool by default", async () => {
    const names = await toolNames(await start([]));

    expect(names).toContain("delete_workflow");
    expect(names).toContain("run_trigger");
  });

  it("hides tools that change or run workflows with --read-only", async () => {
    const names = await toolNames(await start(["--read-only"]));

    expect(names).toContain("list_run_history");
    expect(names).not.toContain("delete_workflow");
    expect(names).not.toContain("run_trigger");
    expect(names).not.toContain("get_trigger_callback_url");
  });

  it("hides them with LOGICAPPS_MCP_READ_ONLY=true", async () => {
    const names = await toolNames(await start([], { LOGICAPPS_MCP_READ_ONLY: "true" }));

    expect(names).not.toContain("delete_workflow");
  });

  it("lets --read-only override LOGICAPPS_MCP_READ_ONLY=false", async () => {
    const names = await toolNames(
      await start(["--read-only"], { LOGICAPPS_MCP_READ_ONLY: "false" })
    );

    expect(names).not.toContain("delete_workflow");
  });

  it("says on stderr that read-only mode is on", async () => {
    const c = await start(["--read-only"]);
    await toolNames(c);

    expect(stderrText).toMatch(/Read-only mode: \d+ of \d+ tools available/);
  });

  it("says nothing about read-only mode by default", async () => {
    const c = await start([]);
    await toolNames(c);

    expect(stderrText).not.toContain("Read-only mode");
  });

  it("refuses a call to a hidden tool", async () => {
    const c = await start(["--read-only"]);

    const result = await c.callTool({ name: "delete_workflow", arguments: {} });
    const text = (result.content as Array<{ text: string }>)[0].text;

    expect(result.isError).toBe(true);
    expect(JSON.parse(text).error.code).toBe("ReadOnlyMode");
  });
});
