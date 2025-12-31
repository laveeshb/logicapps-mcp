/**
 * HTTP transport entry point for cloud deployment.
 * Creates an Express app that handles MCP requests over HTTP.
 *
 * Used by:
 * - Azure Functions (via function wrapper)
 * - Standalone HTTP server (for testing)
 */

import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerToolsAndPrompts } from "../server.js";
import { loadSettings } from "../config/index.js";
import { setSettings, initializeAuth } from "../auth/index.js";

let initialized = false;

/**
 * Initialize auth and settings (called once on cold start).
 */
async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  const settings = await loadSettings();
  setSettings(settings);
  await initializeAuth();
  initialized = true;
}

/**
 * Create a new MCP server instance.
 * Each request gets its own server for stateless operation.
 */
function createMcpServer(): McpServer {
  const mcpServer = new McpServer(
    { name: "logicapps-mcp", version: "0.2.0" },
    { capabilities: { tools: {}, prompts: {} } }
  );
  registerToolsAndPrompts(mcpServer);
  return mcpServer;
}

/**
 * Handle MCP POST requests.
 * Creates a new stateless server for each request.
 */
async function handleMcpPost(req: Request, res: Response): Promise<void> {
  try {
    await ensureInitialized();

    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);

    res.on("close", () => {
      transport.close();
      mcpServer.close();
    });
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
}

/**
 * Handle unsupported methods (GET, DELETE).
 * Stateless mode doesn't support SSE streams or session management.
 */
function handleMethodNotAllowed(_req: Request, res: Response): void {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. This server only supports POST requests.",
    },
    id: null,
  });
}

/**
 * Create Express app for MCP HTTP transport.
 */
export function createMcpApp(): express.Application {
  const app = express();

  // Parse JSON bodies
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: "0.2.0" });
  });

  // MCP endpoints
  app.post("/mcp", handleMcpPost);
  app.get("/mcp", handleMethodNotAllowed);
  app.delete("/mcp", handleMethodNotAllowed);

  return app;
}

/**
 * Start standalone HTTP server (for local testing).
 */
export async function startHttpServer(port: number = 3000): Promise<void> {
  const app = createMcpApp();

  app.listen(port, () => {
    console.log(`MCP HTTP Server listening on port ${port}`);
  });

  process.on("SIGINT", () => {
    console.log("Shutting down server...");
    process.exit(0);
  });
}
