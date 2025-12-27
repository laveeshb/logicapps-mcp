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
import { IncomingMessage, ServerResponse, OutgoingHttpHeaders } from "http";
import { Socket } from "net";
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
 * Create a mock IncomingMessage from Azure Functions HttpRequest.
 */
function createMockIncomingMessage(
  request: HttpRequest,
  bodyBuffer: Buffer
): IncomingMessage {
  const socket = new Socket();
  const incoming = new IncomingMessage(socket);

  // Set method and URL
  incoming.method = request.method;
  incoming.url = new URL(request.url).pathname;

  // Copy headers
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  incoming.headers = headers;

  // Push body data and end the stream
  incoming.push(bodyBuffer);
  incoming.push(null);

  return incoming;
}

/**
 * Create a mock ServerResponse that captures the response.
 */
class MockServerResponse extends ServerResponse {
  private chunks: Buffer[] = [];
  private _statusCode = 200;
  private _headers: Record<string, string> = {};
  private resolvePromise?: () => void;
  private responsePromise: Promise<void>;

  constructor(req: IncomingMessage) {
    super(req);
    this.responsePromise = new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  // @ts-expect-error - Simplified override for our mock response
  override writeHead(
    statusCode: number,
    statusMessage?: string | OutgoingHttpHeaders,
    headers?: OutgoingHttpHeaders
  ): this {
    this._statusCode = statusCode;
    const headerObj =
      typeof statusMessage === "object" ? statusMessage : headers;
    if (headerObj) {
      for (const [key, value] of Object.entries(headerObj)) {
        if (value !== undefined) {
          this._headers[key.toLowerCase()] =
            Array.isArray(value) ? value.join(", ") : String(value);
        }
      }
    }
    return this;
  }

  override setHeader(name: string, value: string | number | string[]): this {
    this._headers[name.toLowerCase()] =
      Array.isArray(value) ? value.join(", ") : String(value);
    return this;
  }

  override write(
    chunk: Buffer | string,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void
  ): boolean {
    const buffer =
      typeof chunk === "string"
        ? Buffer.from(
            chunk,
            typeof encodingOrCallback === "string" ? encodingOrCallback : "utf8"
          )
        : chunk;
    this.chunks.push(buffer);
    const cb =
      typeof encodingOrCallback === "function" ? encodingOrCallback : callback;
    if (cb) cb();
    return true;
  }

  override end(
    chunk?: Buffer | string | (() => void),
    encodingOrCallback?: BufferEncoding | (() => void),
    callback?: () => void
  ): this {
    if (chunk && typeof chunk !== "function") {
      const buffer =
        typeof chunk === "string"
          ? Buffer.from(
              chunk,
              typeof encodingOrCallback === "string"
                ? encodingOrCallback
                : "utf8"
            )
          : chunk;
      this.chunks.push(buffer);
    }
    if (this.resolvePromise) {
      this.resolvePromise();
    }
    const cb =
      typeof chunk === "function"
        ? chunk
        : typeof encodingOrCallback === "function"
          ? encodingOrCallback
          : callback;
    if (cb) cb();
    return this;
  }

  getStatusCode(): number {
    return this._statusCode;
  }

  getResponseHeaders(): Record<string, string> {
    return this._headers;
  }

  getBody(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }

  waitForEnd(): Promise<void> {
    return this.responsePromise;
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

  // Only POST is supported in stateless mode
  if (request.method !== "POST") {
    return {
      status: 405,
      jsonBody: {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message:
            "Method not allowed. This server only supports POST requests.",
        },
        id: null,
      },
    };
  }

  try {
    await ensureInitialized();

    // Get request body as buffer
    const bodyText = await request.text();
    const bodyBuffer = Buffer.from(bodyText, "utf8");
    const bodyJson = JSON.parse(bodyText);

    // Create mock HTTP objects
    const mockReq = createMockIncomingMessage(request, bodyBuffer);
    const mockRes = new MockServerResponse(mockReq);

    // Create MCP server and transport
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
    });

    await server.connect(transport);

    // Handle the request - pass the parsed body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await transport.handleRequest(mockReq, mockRes as any, bodyJson);

    // Wait for response to complete
    await mockRes.waitForEnd();

    // Clean up
    await transport.close();
    await server.close();

    // Return response
    const responseBody = mockRes.getBody();
    context.log(`MCP response: ${responseBody.substring(0, 200)}...`);

    return {
      status: mockRes.getStatusCode(),
      headers: mockRes.getResponseHeaders(),
      body: responseBody,
    };
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
