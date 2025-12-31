/**
 * Error types and formatting for consistent error responses.
 */

export type McpErrorCode =
  | "AuthenticationError"
  | "AuthorizationError"
  | "ResourceNotFound"
  | "InvalidParameter"
  | "UnsupportedOperation"
  | "ConflictError"
  | "RateLimited"
  | "ServiceUnavailable"
  | "ServiceError"
  | "InvalidTool"
  | "UnknownError";

export class McpError extends Error {
  constructor(
    public readonly code: McpErrorCode | string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "McpError";
  }
}

export interface FormattedError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function formatError(error: unknown): FormattedError {
  if (error instanceof McpError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  if (error instanceof Error) {
    return {
      error: {
        code: "UnknownError",
        message: error.message,
      },
    };
  }

  return {
    error: {
      code: "UnknownError",
      message: String(error),
    },
  };
}
