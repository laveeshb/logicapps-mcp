/**
 * Agent endpoint that provides an AI-powered assistant for Logic Apps.
 *
 * This function implements an agent loop that:
 * 1. Receives a user message
 * 2. Calls Azure OpenAI with the available MCP tools
 * 3. Executes any tool calls and feeds results back to the model
 * 4. Returns the final response
 *
 * Configuration (via environment variables):
 * - AI_FOUNDRY_ENDPOINT: Azure OpenAI endpoint URL (required)
 * - AI_FOUNDRY_DEPLOYMENT: Model deployment name (default: gpt-4o)
 *
 * Authentication uses managed identity (DefaultAzureCredential).
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { AzureOpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { TOOL_DEFINITIONS } from "../tools/definitions.js";
import { handleToolCall } from "../tools/handler.js";
import { loadSettings } from "../config/index.js";
import { setSettings, initializeAuth } from "../auth/index.js";

const MAX_ITERATIONS = 10;
const REQUEST_TIMEOUT_MS = 25000; // 25 seconds total
const OPENAI_CALL_TIMEOUT_MS = 12000; // 12 seconds max per OpenAI call
const DEFAULT_SYSTEM_PROMPT = `You are a helpful Azure Logic Apps troubleshooting assistant. Your role is to help users investigate and debug their Logic Apps workflows.

## Interaction Style
- Be conversational and investigative - ask clarifying questions before diving into searches
- When a query is vague, ask for specifics: subscription name, Logic App name, run ID, time range, error message
- Don't try to search across all subscriptions/apps - narrow down first

## Example Interactions
User: "My Logic App is failing"
You: "I'd be happy to help investigate. Could you tell me:
1. Which subscription is it in?
2. What's the Logic App name?
3. Do you have a specific run ID, or should I look at recent failures?"

User: "Show me failed runs"
You: "Sure! To find the right failures:
1. Which Logic App should I check?
2. What time period - last hour, today, or a specific date?"

## When You Have Enough Info
- Use tools to get real data - never make up information
- For debugging failed runs: get_run_actions → find failed action → get_action_io for details
- Present findings clearly with relevant details
- Suggest next steps or fixes when possible

## Important
- If a tool returns an authorization error, tell the user they may not have access to that resource
- Keep responses concise - users want quick answers`;

let mcpInitialized = false;

/**
 * Initialize MCP auth and settings (called once on cold start).
 */
async function ensureMcpInitialized(): Promise<void> {
  if (mcpInitialized) return;

  const settings = await loadSettings();
  setSettings(settings);
  await initializeAuth();
  mcpInitialized = true;
}

/**
 * Create an Azure OpenAI client using managed identity.
 * Configured with limited retries to fail fast on rate limits.
 */
function createOpenAIClient(
  endpoint: string,
  deployment: string
): AzureOpenAI {
  const credential = new DefaultAzureCredential();
  const tokenProvider = getBearerTokenProvider(
    credential,
    "https://cognitiveservices.azure.com/.default"
  );

  return new AzureOpenAI({
    azureADTokenProvider: tokenProvider,
    endpoint,
    deployment,
    apiVersion: "2024-08-01-preview",
    maxRetries: 0, // Fail immediately on rate limits
    timeout: OPENAI_CALL_TIMEOUT_MS, // Hard timeout per request
  });
}

/**
 * Convert MCP tool definitions to OpenAI function format.
 */
function convertToolsToOpenAI(): ChatCompletionTool[] {
  return TOOL_DEFINITIONS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

/**
 * Execute a tool call and return the result.
 */
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: InvocationContext
): Promise<string> {
  try {
    context.log(`Executing tool: ${name} with args: ${JSON.stringify(args)}`);
    const result = await handleToolCall(name, args);

    // Extract text content from the MCP result
    if (result.content && Array.isArray(result.content)) {
      const textResult = result.content
        .map((item) => {
          if (item.type === "text") {
            return item.text;
          }
          return JSON.stringify(item);
        })
        .join("\n");

      // Check if the result is marked as an error
      if (result.isError) {
        context.warn(`Tool ${name} returned error: ${textResult.substring(0, 1000)}`);
        
        // Check for authorization-specific errors
        const authPatterns = [
          "AuthorizationFailed", "AuthorizationError", "AuthenticationError",
          "does not have authorization", "403", "401", "Forbidden", "Unauthorized",
          "Access denied", "access is denied", "permission"
        ];
        const lowerResult = textResult.toLowerCase();
        if (authPatterns.some(p => lowerResult.includes(p.toLowerCase()))) {
          context.error(`Tool ${name} AUTHORIZATION ERROR: ${textResult.substring(0, 1000)}. Args: ${JSON.stringify(args)}`);
        }
      } else {
        context.log(`Tool ${name} completed successfully`);
      }

      return textResult;
    }

    return JSON.stringify(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "";
    const fullError = `${errorName}: ${errorMessage}`;
    
    context.error(`Tool ${name} threw exception: ${fullError}. Args: ${JSON.stringify(args)}`);
    return JSON.stringify({ error: errorMessage });
  }
}

interface AgentRequest {
  /** The user's message to the assistant */
  message: string;
  /** Optional: Continue from previous conversation */
  conversationHistory?: ChatCompletionMessageParam[];
  /** Optional: Override the AI endpoint (defaults to AI_FOUNDRY_ENDPOINT env var) */
  endpoint?: string;
  /** Optional: Override the model deployment (defaults to AI_FOUNDRY_DEPLOYMENT env var) */
  model?: string;
  /** Optional: Custom system prompt */
  systemPrompt?: string;
  /** Optional: Maximum iterations (defaults to 15) */
  maxIterations?: number;
}

interface AgentResponse {
  response: string;
  iterations: number;
  model: string;
  timedOut?: boolean;
  conversationHistory: ChatCompletionMessageParam[];
}

/**
 * Main agent function handler.
 */
async function agentHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    // Initialize MCP tools
    await ensureMcpInitialized();

    // Parse request body
    let body: AgentRequest;
    try {
      body = (await request.json()) as AgentRequest;
    } catch {
      return {
        status: 400,
        jsonBody: { error: "Invalid JSON in request body" },
      };
    }

    if (!body.message) {
      return {
        status: 400,
        jsonBody: { error: "Missing 'message' in request body" },
      };
    }

    // Get configuration from request or environment
    const endpoint = body.endpoint || process.env.AI_FOUNDRY_ENDPOINT;
    const deployment = body.model || process.env.AI_FOUNDRY_DEPLOYMENT || "gpt-4o";
    const systemPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const maxIterations = body.maxIterations || MAX_ITERATIONS;

    if (!endpoint) {
      return {
        status: 400,
        jsonBody: {
          error: "Missing AI endpoint. Set AI_FOUNDRY_ENDPOINT environment variable or provide 'endpoint' in request body.",
        },
      };
    }

    context.log(`Agent starting with model: ${deployment} at ${endpoint}`);
    context.log(`User message: ${body.message.substring(0, 100)}...`);

    // Create OpenAI client (uses managed identity)
    const openaiClient = createOpenAIClient(endpoint, deployment);

    // Initialize conversation with system prompt and user message
    const messages: ChatCompletionMessageParam[] = body.conversationHistory || [
      { role: "system", content: systemPrompt },
    ];

    // Add user message
    messages.push({ role: "user", content: body.message });

    const tools = convertToolsToOpenAI();
    let iterations = 0;
    let finalResponse = "";
    const startTime = Date.now();
    let timedOut = false;

    // Agent loop
    while (iterations < maxIterations) {
      iterations++;
      const elapsed = Date.now() - startTime;
      context.log(`Agent iteration ${iterations}, elapsed: ${elapsed}ms`);

      // Check if we're approaching timeout
      if (elapsed > REQUEST_TIMEOUT_MS) {
        context.warn(`Request timeout approaching after ${elapsed}ms, forcing final response`);
        timedOut = true;

        // Ask LLM to summarize what we have so far
        messages.push({
          role: "system",
          content: "TIME LIMIT REACHED. Summarize your findings so far in 2-3 sentences. Be honest about what you couldn't complete.",
        });

        try {
          const finalCompletion = await openaiClient.chat.completions.create({
            model: deployment,
            messages,
            max_tokens: 300, // Short response
          });
          finalResponse = finalCompletion.choices[0]?.message?.content
            || "Request timed out. Try being more specific - for example, specify the subscription or Logic App name.";
        } catch {
          finalResponse = "Request timed out. Try being more specific - for example, specify the subscription or Logic App name.";
        }
        break;
      }

      // Call the AI model
      const completion = await openaiClient.chat.completions.create({
        model: deployment,
        messages,
        tools,
        tool_choice: "auto",
        max_tokens: 4096,
      });

      const assistantMessage = completion.choices[0]?.message;

      if (!assistantMessage) {
        throw new Error("No response from AI model");
      }

      // Add assistant message to history
      messages.push(assistantMessage);

      // Check if we have tool calls
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        context.log(`Processing ${assistantMessage.tool_calls.length} tool calls`);

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            args = {};
            context.warn(`Failed to parse arguments for ${toolCall.function.name}`);
          }

          const result = await executeTool(toolCall.function.name, args, context);

          // Add tool result to messages
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
      } else {
        // No tool calls - we have the final response
        finalResponse = assistantMessage.content || "No response generated.";
        break;
      }
    }

    if (!finalResponse && iterations >= maxIterations) {
      finalResponse = "Maximum iterations reached without a final response.";
    }

    const response: AgentResponse = {
      response: finalResponse,
      iterations,
      model: deployment,
      timedOut,
      conversationHistory: messages,
    };

    context.log(`Agent completed in ${iterations} iterations`);

    return {
      status: 200,
      jsonBody: response,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    context.error(`Agent error: ${errorMessage}`);
    if (errorStack) {
      context.error(errorStack);
    }

    // Check for timeout errors
    const isTimeoutError = errorMessage.includes("timed out") ||
                           errorMessage.includes("timeout");

    if (isTimeoutError) {
      return {
        status: 504,
        jsonBody: {
          error: "The request timed out. Try being more specific - for example, specify the subscription or Logic App name directly.",
          details: errorMessage,
        },
      };
    }

    // Check for rate limit errors from OpenAI
    const isRateLimitError = errorMessage.includes("429") ||
                             errorMessage.includes("rate limit") ||
                             errorMessage.includes("exceeded") ||
                             errorMessage.includes("throttl");

    if (isRateLimitError) {
      // Extract retry-after time if present (e.g., "retry after 60 seconds")
      const retryMatch = errorMessage.match(/retry after (\d+) seconds/i);
      const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : 60;

      return {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
        },
        jsonBody: {
          error: `Azure OpenAI rate limit reached. The model deployment has exceeded its tokens-per-minute quota. Please wait ${retryAfter} seconds and try again.`,
          retryAfter,
          details: errorMessage,
        },
      };
    }

    return {
      status: 500,
      jsonBody: { error: errorMessage },
    };
  }
}

// Register the agent function
app.http("agent", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "agent",
  handler: agentHandler,
});

export { agentHandler };
