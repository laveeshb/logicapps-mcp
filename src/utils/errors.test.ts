import { describe, it, expect } from "vitest";
import { McpError, formatError } from "./errors.js";

describe("errors", () => {
  describe("McpError", () => {
    it("should create an error with code and message", () => {
      const error = new McpError("AuthenticationError", "Invalid token");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe("AuthenticationError");
      expect(error.message).toBe("Invalid token");
      expect(error.name).toBe("McpError");
    });

    it("should create an error with details", () => {
      const details = { requestId: "123", timestamp: "2024-01-01" };
      const error = new McpError("ServiceError", "API failed", details);

      expect(error.details).toEqual(details);
    });

    it("should support custom error codes", () => {
      const error = new McpError("CustomCode", "Custom message");
      expect(error.code).toBe("CustomCode");
    });

    it("should create UnsupportedOperation error", () => {
      const error = new McpError(
        "UnsupportedOperation",
        "This operation is not supported for Consumption Logic Apps"
      );

      expect(error.code).toBe("UnsupportedOperation");
      expect(error.message).toBe("This operation is not supported for Consumption Logic Apps");
    });

    it("should create ConflictError for concurrent modifications", () => {
      const error = new McpError(
        "ConflictError",
        "Resource was modified by another process. Please retry the operation."
      );

      expect(error.code).toBe("ConflictError");
      expect(error.message).toBe("Resource was modified by another process. Please retry the operation.");
    });
  });

  describe("formatError", () => {
    it("should format McpError correctly", () => {
      const error = new McpError("ResourceNotFound", "Workflow not found");
      const formatted = formatError(error);

      expect(formatted).toEqual({
        error: {
          code: "ResourceNotFound",
          message: "Workflow not found",
          details: undefined,
        },
      });
    });

    it("should format McpError with details", () => {
      const details = { resourceId: "/subscriptions/123" };
      const error = new McpError("ResourceNotFound", "Not found", details);
      const formatted = formatError(error);

      expect(formatted.error.details).toEqual(details);
    });

    it("should format regular Error as UnknownError", () => {
      const error = new Error("Something went wrong");
      const formatted = formatError(error);

      expect(formatted).toEqual({
        error: {
          code: "UnknownError",
          message: "Something went wrong",
        },
      });
    });

    it("should format string errors", () => {
      const formatted = formatError("String error");

      expect(formatted).toEqual({
        error: {
          code: "UnknownError",
          message: "String error",
        },
      });
    });

    it("should format null/undefined errors", () => {
      expect(formatError(null)).toEqual({
        error: {
          code: "UnknownError",
          message: "null",
        },
      });

      expect(formatError(undefined)).toEqual({
        error: {
          code: "UnknownError",
          message: "undefined",
        },
      });
    });

    it("should format object errors", () => {
      const formatted = formatError({ foo: "bar" });

      expect(formatted.error.code).toBe("UnknownError");
      expect(formatted.error.message).toBe("[object Object]");
    });
  });
});
