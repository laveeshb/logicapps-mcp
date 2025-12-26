import { describe, it, expect, vi, beforeEach } from "vitest";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { registerTools } from "./server.js";

describe("server", () => {
  let server: Server;
  let handlers: Map<unknown, Function>;

  beforeEach(() => {
    handlers = new Map();
    server = {
      setRequestHandler: vi.fn((schema, handler) => {
        handlers.set(schema, handler);
      }),
    } as unknown as Server;
    registerTools(server);
  });

  describe("prompts", () => {
    it("should register prompts/list handler", () => {
      expect(handlers.has(ListPromptsRequestSchema)).toBe(true);
    });

    it("should register prompts/get handler", () => {
      expect(handlers.has(GetPromptRequestSchema)).toBe(true);
    });

    it("should list logic-apps-guide prompt", async () => {
      const handler = handlers.get(ListPromptsRequestSchema);
      const result = await handler!();

      expect(result.prompts).toHaveLength(2);
      expect(result.prompts[0].name).toBe("logic-apps-guide");
      expect(result.prompts[0].description).toContain("Azure Logic Apps");
      expect(result.prompts[1].name).toBe("native-operations-guide");
      expect(result.prompts[1].description).toContain("native Logic Apps operations");
    });

    it("should return logic-apps-guide content", async () => {
      const handler = handlers.get(GetPromptRequestSchema);
      const result = await handler!({ params: { name: "logic-apps-guide" } });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.type).toBe("text");
      expect(result.messages[0].content.text).toContain("SKU Types");
      expect(result.messages[0].content.text).toContain("Consumption");
      expect(result.messages[0].content.text).toContain("Standard");
    });

    it("should return native-operations-guide content", async () => {
      const handler = handlers.get(GetPromptRequestSchema);
      const result = await handler!({ params: { name: "native-operations-guide" } });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.type).toBe("text");
      expect(result.messages[0].content.text).toContain("Native Operations Reference");
      expect(result.messages[0].content.text).toContain("Compose");
      expect(result.messages[0].content.text).toContain("For Each Loop");
      expect(result.messages[0].content.text).toContain("Condition");
    });

    it("should throw error for unknown prompt", async () => {
      const handler = handlers.get(GetPromptRequestSchema);

      await expect(
        handler!({ params: { name: "unknown-prompt" } })
      ).rejects.toThrow("Unknown prompt: unknown-prompt");
    });
  });

  describe("tools", () => {
    it("should register tools/list handler", () => {
      expect(handlers.has(ListToolsRequestSchema)).toBe(true);
    });

    it("should register tools/call handler", () => {
      expect(handlers.has(CallToolRequestSchema)).toBe(true);
    });

    it("should list all tools", async () => {
      const handler = handlers.get(ListToolsRequestSchema);
      const result = await handler!();

      expect(result.tools.length).toBeGreaterThan(0);
      expect(result.tools[0]).toHaveProperty("name");
      expect(result.tools[0]).toHaveProperty("description");
      expect(result.tools[0]).toHaveProperty("inputSchema");
    });
  });
});
