/**
 * Auth prototype for M365 Copilot plugin.
 * REQUIRES bearer token - no anonymous access to prevent unauthorized use of managed identity.
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

const ARM_ENDPOINT = "https://management.azure.com";

interface AuthTestResult {
  method: "user_token";
  success: boolean;
  subscriptions?: Array<{ id: string; displayName: string }>;
  error?: string;
  headers_received?: Record<string, string>;
  token_info?: {
    present: boolean;
    preview?: string;
  };
}

/**
 * Try to list subscriptions using provided token.
 */
async function listSubscriptions(token: string): Promise<Array<{ id: string; displayName: string }>> {
  const response = await fetch(
    `${ARM_ENDPOINT}/subscriptions?api-version=2022-12-01`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ARM API error (${response.status}): ${error}`);
  }

  const data = await response.json() as { value: Array<{ subscriptionId: string; displayName: string }> };
  return data.value.map((sub) => ({
    id: sub.subscriptionId,
    displayName: sub.displayName,
  }));
}

/**
 * Auth test endpoint handler.
 * REQUIRES Authorization header with Bearer token - returns 401 if missing.
 */
async function authTestHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Log all headers for debugging (masking sensitive values)
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key.toLowerCase().includes("auth") || key.toLowerCase().includes("token")) {
      headers[key] = value ? `${value.substring(0, 20)}...` : "(empty)";
    } else {
      headers[key] = value;
    }
  });
  context.log("Received headers:", JSON.stringify(headers, null, 2));

  // Check for user token in Authorization header
  const authHeader = request.headers.get("authorization");
  const userToken = authHeader?.replace(/^Bearer\s+/i, "");

  // REQUIRE bearer token - no anonymous access
  if (!userToken) {
    context.warn("No bearer token provided - returning 401");
    return {
      status: 401,
      jsonBody: {
        error: "Authorization required",
        message: "Bearer token must be provided in Authorization header",
        headers_received: headers,
      },
    };
  }

  const result: AuthTestResult = {
    method: "user_token",
    success: false,
    headers_received: headers,
    token_info: {
      present: true,
      preview: `${userToken.substring(0, 30)}...`,
    },
  };

  // Use provided token for ARM call
  context.log("Attempting to use user token for ARM call...");
  try {
    result.subscriptions = await listSubscriptions(userToken);
    result.success = true;
    context.log(`User token worked! Found ${result.subscriptions.length} subscriptions`);
    return {
      status: 200,
      jsonBody: result,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    context.error(`User token failed: ${errorMsg}`);
    result.error = `Token validation failed: ${errorMsg}`;
    return {
      status: 403,
      jsonBody: result,
    };
  }
}

// Register the endpoint
app.http("copilot-auth-test", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "copilot/auth-test",
  handler: authTestHandler,
});

export { authTestHandler };
