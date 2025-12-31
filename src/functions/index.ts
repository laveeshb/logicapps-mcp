/**
 * Azure Functions entry point for the MCP server.
 *
 * This module provides HTTP triggers for the MCP protocol endpoints,
 * allowing the MCP server to run as an Azure Function.
 *
 * Uses WebStandardStreamableHTTPServerTransport which works directly with
 * Web Standard Request/Response objects that Azure Functions v4 supports.
 *
 * Requires passthrough authentication: a bearer token must be provided in
 * the Authorization header. This token is used for ARM API calls.
 * No fallback to Managed Identity - user token is always required.
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerTools } from "../server.js";
import { loadSettings } from "../config/index.js";
import { setSettings, initializeAuth, setPassthroughToken, clearPassthroughToken } from "../auth/index.js";

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
 * Convert Web Standard Response to Azure Functions HttpResponseInit.
 */
async function convertResponse(
  response: Response
): Promise<HttpResponseInit> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Handle streaming responses (SSE)
  if (response.body && headers["content-type"]?.includes("text/event-stream")) {
    // For SSE, we need to read the entire stream and return it
    // Azure Functions doesn't support true streaming, so we buffer the response
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];

    // Read with a timeout to avoid hanging on long-lived SSE streams
    const readWithTimeout = async (): Promise<void> => {
      const decoder = new TextDecoder();
      let totalRead = 0;
      const maxBytes = 1024 * 1024; // 1MB limit

      while (totalRead < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          totalRead += value.length;
          // Check if we've received a complete JSON-RPC response
          const text = decoder.decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
          if (text.includes('"jsonrpc"') && text.includes('\n\n')) {
            break;
          }
        }
      }
    };

    await readWithTimeout();

    const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString(
      "utf-8"
    );

    return {
      status: response.status,
      headers,
      body,
    };
  }

  // For non-streaming responses, read the body as text
  const body = await response.text();
  return {
    status: response.status,
    headers,
    body,
  };
}

/**
 * Convert Azure Functions HttpRequest to Web Standard Request.
 */
async function convertRequest(request: HttpRequest): Promise<Request> {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    headers.set(key, value);
  });

  const body = await request.text();

  return new Request(request.url, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? body : undefined,
  });
}

/**
 * Main MCP HTTP handler for Azure Functions.
 * Supports passthrough auth: extracts bearer token from Authorization header.
 */
async function mcpHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`MCP ${request.method} request received`);

  try {
    await ensureInitialized();

    // Extract bearer token for passthrough auth (required)
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, "");

    if (bearerToken) {
      setPassthroughToken(bearerToken);
    }
    // If no token, tools will fail with AuthenticationError when they try to get token

    try {
      // Convert Azure Functions request to Web Standard Request
      const webRequest = await convertRequest(request);

      // Create MCP server and transport
      const server = createMcpServer();
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
        enableJsonResponse: true, // Return JSON instead of SSE where possible
      });

      await server.connect(transport);

      // Handle the request
      const response = await transport.handleRequest(webRequest);

      // Clean up
      await transport.close();
      await server.close();

      // Convert Web Standard Response to Azure Functions response
      const azResponse = await convertResponse(response);
      context.log(`MCP response status: ${azResponse.status}`);

      return azResponse;
    } finally {
      // Always clear the passthrough token after request
      clearPassthroughToken();
    }
  } catch (error) {
    context.error("Error handling MCP request:", error);
    return {
      status: 500,
      jsonBody: {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message:
            error instanceof Error ? error.message : "Internal server error",
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
