import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { registerToolsAndPrompts } from "./server.js";

describe("server", () => {
  let mcpServer: McpServer;
  let toolHandlers: Map<unknown, (...args: unknown[]) => unknown>;
  let registeredPrompts: Map<string, { description?: string; callback: (...args: unknown[]) => unknown }>;

  beforeEach(() => {
    toolHandlers = new Map();
    registeredPrompts = new Map();

    // Mock the underlying server
    const mockServer = {
      setRequestHandler: vi.fn((schema, handler) => {
        toolHandlers.set(schema, handler);
      }),
    };

    // Mock McpServer
    mcpServer = {
      server: mockServer,
      registerPrompt: vi.fn((name, config, callback) => {
        registeredPrompts.set(name, { description: config.description, callback });
      }),
    } as unknown as McpServer;

    registerToolsAndPrompts(mcpServer);
  });

  describe("prompts", () => {
    it("should register logic-apps-guide prompt", () => {
      expect(registeredPrompts.has("logic-apps-guide")).toBe(true);
    });

    it("should register native-operations-guide prompt", () => {
      expect(registeredPrompts.has("native-operations-guide")).toBe(true);
    });

    it("should list both prompts with descriptions", () => {
      expect(registeredPrompts.size).toBe(2);

      const logicAppsGuide = registeredPrompts.get("logic-apps-guide");
      expect(logicAppsGuide?.description).toContain("Azure Logic Apps");

      const nativeOpsGuide = registeredPrompts.get("native-operations-guide");
      expect(nativeOpsGuide?.description).toContain("native Logic Apps operations");
    });

    it("should return logic-apps-guide content", async () => {
      const prompt = registeredPrompts.get("logic-apps-guide");
      const result = (await prompt!.callback()) as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.type).toBe("text");
      expect(result.messages[0].content.text).toContain("SKU Types");
      expect(result.messages[0].content.text).toContain("Consumption");
      expect(result.messages[0].content.text).toContain("Standard");
    });

    it("should return native-operations-guide content", async () => {
      const prompt = registeredPrompts.get("native-operations-guide");
      const result = (await prompt!.callback()) as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.type).toBe("text");
      expect(result.messages[0].content.text).toContain("Native Operations Reference");
      expect(result.messages[0].content.text).toContain("Compose");
      expect(result.messages[0].content.text).toContain("For Each Loop");
      expect(result.messages[0].content.text).toContain("Condition");
    });
  });

  describe("tools", () => {
    it("should register tools/list handler", () => {
      expect(toolHandlers.has(ListToolsRequestSchema)).toBe(true);
    });

    it("should register tools/call handler", () => {
      expect(toolHandlers.has(CallToolRequestSchema)).toBe(true);
    });

    it("should list all tools", async () => {
      const handler = toolHandlers.get(ListToolsRequestSchema);
      const result = (await handler!()) as {
        tools: Array<{ name: string; description: string; inputSchema: unknown }>;
      };

      expect(result.tools.length).toBeGreaterThan(0);
      expect(result.tools[0]).toHaveProperty("name");
      expect(result.tools[0]).toHaveProperty("description");
      expect(result.tools[0]).toHaveProperty("inputSchema");
    });

    it("should have list_subscriptions tool", async () => {
      const handler = toolHandlers.get(ListToolsRequestSchema);
      const result = (await handler!()) as {
        tools: Array<{ name: string }>;
      };

      const tool = result.tools.find((t) => t.name === "list_subscriptions");
      expect(tool).toBeDefined();
    });

    it("should have list_logic_apps tool", async () => {
      const handler = toolHandlers.get(ListToolsRequestSchema);
      const result = (await handler!()) as {
        tools: Array<{ name: string }>;
      };

      const tool = result.tools.find((t) => t.name === "list_logic_apps");
      expect(tool).toBeDefined();
    });
  });
});
