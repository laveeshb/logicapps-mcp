#!/usr/bin/env node

/**
 * MCP Server entry point.
 *
 * Supports two modes:
 * - stdio (default): For local MCP clients (Claude Desktop, VS Code Copilot)
 * - http: For cloud deployment (Azure Functions, standalone server)
 *
 * Usage:
 *   npx logicapps-mcp          # stdio mode (default)
 *   npx logicapps-mcp --http   # HTTP server mode
 *   npx logicapps-mcp --http --port 8080
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadSettings } from "./config/index.js";
import { setSettings, initializeAuth } from "./auth/index.js";
import { setCacheTtl } from "./tools/index.js";
import { registerToolsAndPrompts } from "./server.js";
import { VERSION } from "./version.js";

/**
 * Run MCP server in stdio mode (for local MCP clients).
 */
async function runStdioMode(): Promise<void> {
  const settings = await loadSettings();
  setSettings(settings);
  setCacheTtl(settings.cacheTtlSeconds);
  await initializeAuth();

  const mcpServer = new McpServer(
    { name: "logicapps-mcp", version: VERSION },
    { capabilities: { tools: {}, prompts: {} } }
  );

  registerToolsAndPrompts(mcpServer);

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  process.on("SIGINT", async () => {
    await mcpServer.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await mcpServer.close();
    process.exit(0);
  });
}

/**
 * Run MCP server in HTTP mode (for cloud deployment).
 */
async function runHttpMode(port: number): Promise<void> {
  // Dynamic import to avoid loading Express in stdio mode
  const { startHttpServer } = await import("./http/index.js");
  await startHttpServer(port);
}

/**
 * Parse command line arguments.
 */
function parseArgs(): { mode: "stdio" | "http"; port: number } {
  const args = process.argv.slice(2);
  const isHttp = args.includes("--http");

  let port = 3000;
  const portIndex = args.indexOf("--port");
  if (portIndex !== -1 && args[portIndex + 1]) {
    port = parseInt(args[portIndex + 1], 10);
  }

  // Also check MCP_PORT env var (for Azure Functions)
  if (process.env.MCP_PORT) {
    port = parseInt(process.env.MCP_PORT, 10);
  }

  return {
    mode: isHttp ? "http" : "stdio",
    port,
  };
}

async function main(): Promise<void> {
  const { mode, port } = parseArgs();

  if (mode === "http") {
    await runHttpMode(port);
  } else {
    await runStdioMode();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
