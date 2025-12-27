/**
 * Azure Functions entry point for the MCP server.
 *
 * This module provides HTTP triggers for the MCP protocol endpoints,
 * allowing the MCP server to run as an Azure Function.
 *
 * Deployment:
 * 1. Deploy this function app to Azure
 * 2. Configure Managed Identity
 * 3. Set up Easy Auth to restrict access
 * 4. Connect from Logic Apps Agent Loop
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Readable } from "stream";
import { registerTools } from "../server.js";
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
 */
function createMcpServer(): Server {
  const server = new Server(
    { name: "logicapps-mcp", version: "0.2.0" },
    { capabilities: { tools: {}, prompts: {} } }
  );
  registerTools(server);
  return server;
}

/**
 * Convert Azure Functions HttpRequest to Express-compatible request.
 */
function createExpressRequest(request: HttpRequest, body: unknown): {
  body: unknown;
  headers: Record<string, string>;
  method: string;
} {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return {
    body,
    headers,
    method: request.method,
  };
}

/**
 * Capture response from StreamableHTTPServerTransport.
 */
class ResponseCapture {
  statusCode = 200;
  headers: Record<string, string> = {};
  chunks: Buffer[] = [];
  headersSent = false;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  setHeader(name: string, value: string): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  set(name: string, value: string): this {
    return this.setHeader(name, value);
  }

  writeHead(statusCode: number, headers?: Record<string, string>): this {
    this.statusCode = statusCode;
    if (headers) {
      Object.entries(headers).forEach(([k, v]) => this.setHeader(k, v));
    }
    this.headersSent = true;
    return this;
  }

  write(chunk: string | Buffer): boolean {
    if (typeof chunk === "string") {
      this.chunks.push(Buffer.from(chunk));
    } else {
      this.chunks.push(chunk);
    }
    return true;
  }

  end(chunk?: string | Buffer): this {
    if (chunk) {
      this.write(chunk);
    }
    return this;
  }

  json(data: unknown): this {
    this.setHeader("content-type", "application/json");
    this.write(JSON.stringify(data));
    return this;
  }

  getBody(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }

  on(_event: string, _handler: () => void): this {
    // Event handlers not needed for stateless mode
    return this;
  }
}

/**
 * Main MCP HTTP handler for Azure Functions.
 */
async function mcpHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`MCP ${request.method} request received`);

  // Handle health check
  if (request.url.endsWith("/health")) {
    return {
      status: 200,
      jsonBody: { status: "ok", version: "0.2.0" },
    };
  }

  // Only POST is supported in stateless mode
  if (request.method !== "POST") {
    return {
      status: 405,
      jsonBody: {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed. This server only supports POST requests.",
        },
        id: null,
      },
    };
  }

  try {
    await ensureInitialized();

    // Parse request body
    const body = await request.json();

    // Create Express-compatible request/response
    const expressReq = createExpressRequest(request, body);
    const expressRes = new ResponseCapture();

    // Create MCP server and transport
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
    });

    await server.connect(transport);

    // Handle the request
    await transport.handleRequest(
      expressReq as never,
      expressRes as never,
      body
    );

    // Clean up
    await transport.close();
    await server.close();

    // Return response
    return {
      status: expressRes.statusCode,
      headers: expressRes.headers,
      body: expressRes.getBody(),
    };
  } catch (error) {
    context.error("Error handling MCP request:", error);
    return {
      status: 500,
      jsonBody: {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      },
    };
  }
}

// Register the Azure Function
app.http("mcp", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "anonymous", // Auth handled by Easy Auth
  route: "mcp",
  handler: mcpHandler,
});

// Health check endpoint
app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: async () => ({
    status: 200,
    jsonBody: { status: "ok", version: "0.2.0" },
  }),
});
