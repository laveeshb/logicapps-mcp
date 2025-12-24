#!/usr/bin/env node

/**
 * MCP Server entry point.
 * - Loads configuration
 * - Initializes authentication
 * - Registers all tools
 * - Handles graceful shutdown
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadSettings } from "./config/index.js";
import { setSettings, initializeAuth } from "./auth/index.js";
import { registerTools } from "./server.js";

async function main(): Promise<void> {
  // Load configuration first
  const settings = await loadSettings();
  setSettings(settings);

  // Initialize authentication at startup
  // This verifies Azure CLI is available and user is logged in
  await initializeAuth();

  const server = new Server(
    { name: "flowie", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle shutdown
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
