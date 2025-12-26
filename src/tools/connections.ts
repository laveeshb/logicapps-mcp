/**
 * API Connection operations.
 */

import { armRequest, armRequestAllPages } from "../utils/http.js";
import { ApiConnection } from "../types/logicApp.js";
import { McpError } from "../utils/errors.js";
import { getAccessToken } from "../auth/tokenManager.js";
import { getCloudEndpoints } from "../config/clouds.js";

export interface GetConnectionsResult {
  connections: Array<{
    id: string;
    name: string;
    apiName: string;
    displayName: string;
    status: string;
    createdTime: string;
  }>;
}

export async function getConnections(
  subscriptionId: string,
  resourceGroupName: string
): Promise<GetConnectionsResult> {
  const connections = await armRequestAllPages<ApiConnection>(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/connections`,
    { "api-version": "2018-07-01-preview" }
  );

  return {
    connections: connections.map((conn) => ({
      id: conn.id,
      name: conn.name,
      apiName: conn.properties.api.name,
      displayName: conn.properties.displayName,
      status: conn.properties.statuses?.[0]?.status ?? "Unknown",
      createdTime: conn.properties.createdTime,
    })),
  };
}

export interface GetConnectionDetailsResult {
  id: string;
  name: string;
  location: string;
  api: {
    name: string;
    displayName: string;
    id: string;
  };
  displayName: string;
  status: string;
  statuses: Array<{ status: string; error?: { code: string; message: string } }>;
  createdTime: string;
  changedTime?: string;
  parameterValues?: Record<string, unknown>;
  customParameterValues?: Record<string, unknown>;
  testLinks?: Array<{ requestUri: string; method: string }>;
}

/**
 * Get detailed information about a specific API connection.
 */
export async function getConnectionDetails(
  subscriptionId: string,
  resourceGroupName: string,
  connectionName: string
): Promise<GetConnectionDetailsResult> {
  interface ConnectionResponse {
    id: string;
    name: string;
    location: string;
    properties: {
      api: { name: string; displayName: string; id: string };
      displayName: string;
      statuses: Array<{ status: string; error?: { code: string; message: string } }>;
      createdTime: string;
      changedTime?: string;
      parameterValues?: Record<string, unknown>;
      customParameterValues?: Record<string, unknown>;
      testLinks?: Array<{ requestUri: string; method: string }>;
    };
  }

  const conn = await armRequest<ConnectionResponse>(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/connections/${connectionName}`,
    { queryParams: { "api-version": "2018-07-01-preview" } }
  );

  return {
    id: conn.id,
    name: conn.name,
    location: conn.location,
    api: conn.properties.api,
    displayName: conn.properties.displayName,
    status: conn.properties.statuses?.[0]?.status ?? "Unknown",
    statuses: conn.properties.statuses ?? [],
    createdTime: conn.properties.createdTime,
    changedTime: conn.properties.changedTime,
    parameterValues: conn.properties.parameterValues,
    customParameterValues: conn.properties.customParameterValues,
    testLinks: conn.properties.testLinks,
  };
}

export interface TestConnectionResult {
  connectionName: string;
  isValid: boolean;
  status: string;
  error?: {
    code: string;
    message: string;
  };
  testedAt: string;
}

/**
 * Test if an API connection is valid/healthy.
 * Uses the testLinks from the connection if available.
 */
export async function testConnection(
  subscriptionId: string,
  resourceGroupName: string,
  connectionName: string
): Promise<TestConnectionResult> {
  // First get the connection details to check status and get test links
  const details = await getConnectionDetails(
    subscriptionId,
    resourceGroupName,
    connectionName
  );

  const result: TestConnectionResult = {
    connectionName,
    isValid: false,
    status: details.status,
    testedAt: new Date().toISOString(),
  };

  // Check if there's already an error in the status
  const statusError = details.statuses.find((s) => s.error);
  if (statusError?.error) {
    result.error = statusError.error;
    return result;
  }

  // If status is Connected, it's valid
  if (details.status === "Connected") {
    result.isValid = true;
    return result;
  }

  // If there are test links, try to use them
  if (details.testLinks && details.testLinks.length > 0) {
    const testLink = details.testLinks[0];
    const token = await getAccessToken();
    const cloud = getCloudEndpoints();

    try {
      // The testLink requestUri is a relative path
      const url = `${cloud.resourceManager}${testLink.requestUri}`;
      const response = await fetch(url, {
        method: testLink.method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        result.isValid = true;
        result.status = "Connected";
      } else {
        const errorBody = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
        result.error = {
          code: errorBody.error?.code ?? `HTTP${response.status}`,
          message: errorBody.error?.message ?? response.statusText,
        };
      }
    } catch (err) {
      result.error = {
        code: "TestFailed",
        message: err instanceof Error ? err.message : "Connection test failed",
      };
    }

    return result;
  }

  // No test links and status isn't Connected - report current status
  if (details.status !== "Connected") {
    result.error = {
      code: "NotConnected",
      message: `Connection status is ${details.status}`,
    };
  }

  return result;
}

export interface GetConnectorSwaggerResult {
  connectorName: string;
  displayName: string;
  description: string;
  iconUri?: string;
  swagger?: {
    basePath?: string;
    paths: Record<string, Record<string, {
      operationId?: string;
      summary?: string;
      description?: string;
      parameters?: Array<{
        name: string;
        in: string;
        required?: boolean;
        type?: string;
        description?: string;
      }>;
    }>>;
    definitions?: Record<string, unknown>;
  };
  capabilities?: string[];
  connectionParameters?: Record<string, unknown>;
}

/**
 * Get the OpenAPI/Swagger definition for a managed connector.
 * This is essential for discovering correct action paths when creating workflows.
 */
export async function getConnectorSwagger(
  subscriptionId: string,
  location: string,
  connectorName: string
): Promise<GetConnectorSwaggerResult> {
  // Swagger response structure (returned when export=true)
  interface SwaggerResponse {
    swagger?: string;
    info?: {
      title?: string;
      description?: string;
    };
    host?: string;
    basePath?: string;
    paths?: Record<string, Record<string, {
      operationId?: string;
      summary?: string;
      description?: string;
      parameters?: Array<{
        name: string;
        in: string;
        required?: boolean;
        type?: string;
        description?: string;
        "x-ms-dynamic-values"?: {
          operationId?: string;
          parameters?: Record<string, unknown>;
          "value-path"?: string;
          "value-title"?: string;
          "value-collection"?: string;
        };
        "x-ms-dynamic-schema"?: {
          operationId?: string;
          parameters?: Record<string, unknown>;
          "value-path"?: string;
        };
      }>;
    }>>;
    definitions?: Record<string, unknown>;
    "x-ms-capabilities"?: Record<string, unknown>;
  }

  // Connector metadata response (returned without export)
  interface ConnectorMetadataResponse {
    id: string;
    name: string;
    properties: {
      name: string;
      generalInformation?: {
        displayName?: string;
        description?: string;
        iconUrl?: string;
      };
      capabilities?: string[];
      connectionParameters?: Record<string, unknown>;
    };
  }

  // First, get the swagger definition with export=true
  const swagger = await armRequest<SwaggerResponse>(
    `/subscriptions/${subscriptionId}/providers/Microsoft.Web/locations/${location}/managedApis/${connectorName}`,
    { queryParams: { "api-version": "2018-07-01-preview", "export": "true" } }
  );

  // Then get connector metadata (without export) for display info
  const metadata = await armRequest<ConnectorMetadataResponse>(
    `/subscriptions/${subscriptionId}/providers/Microsoft.Web/locations/${location}/managedApis/${connectorName}`,
    { queryParams: { "api-version": "2018-07-01-preview" } }
  );

  const result: GetConnectorSwaggerResult = {
    connectorName: metadata.name,
    displayName: metadata.properties.generalInformation?.displayName ?? swagger.info?.title ?? metadata.name,
    description: metadata.properties.generalInformation?.description ?? swagger.info?.description ?? "",
    iconUri: metadata.properties.generalInformation?.iconUrl,
    capabilities: metadata.properties.capabilities,
    connectionParameters: metadata.properties.connectionParameters,
  };

  // Add swagger if available
  if (swagger.paths) {
    result.swagger = {
      basePath: swagger.basePath,
      paths: swagger.paths,
      definitions: swagger.definitions,
    };
  }

  return result;
}

export interface InvokeConnectorOperationResult {
  operationId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Invoke a dynamic operation on an API connection to fetch connection-specific data.
 * This is how the Logic Apps designer populates dropdowns and fetches schemas.
 */
export async function invokeConnectorOperation(
  subscriptionId: string,
  resourceGroupName: string,
  connectionName: string,
  operationId: string,
  parameters?: Record<string, unknown>
): Promise<InvokeConnectorOperationResult> {
  // First, test if the connection is authorized/connected
  const connectionTest = await testConnection(subscriptionId, resourceGroupName, connectionName);
  if (!connectionTest.isValid) {
    const portalUrl = `https://portal.azure.com/#@/resource/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/connections/${connectionName}`;
    return {
      operationId,
      success: false,
      error: `Connection '${connectionName}' is not authorized. Status: ${connectionTest.status}. ${connectionTest.error ? `Error: ${connectionTest.error.message}` : ''} Authorize it in the Azure Portal: ${portalUrl}`,
    };
  }

  // Get the connection details to find the API it's connected to and its location
  const connection = await armRequest<{
    id: string;
    name: string;
    location: string;
    properties: {
      api: {
        name: string;
        id: string;
      };
    };
  }>(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/connections/${connectionName}`,
    { queryParams: { "api-version": "2018-07-01-preview" } }
  );

  const apiName = connection.properties.api.name;
  const location = connection.location;

  // Get the connector swagger to find the operation path
  const connectorResponse = await armRequest<{
    swagger?: string;
    basePath?: string;
    paths?: Record<string, Record<string, {
      operationId?: string;
      parameters?: Array<{
        name: string;
        in: string;
        required?: boolean;
      }>;
    }>>;
  }>(
    `/subscriptions/${subscriptionId}/providers/Microsoft.Web/locations/${location}/managedApis/${apiName}`,
    { queryParams: { "api-version": "2018-07-01-preview", "export": "true" } }
  );

  // Find the operation in the swagger
  let operationPath: string | undefined;
  let httpMethod: string | undefined;
  let operationDef: {
    operationId?: string;
    parameters?: Array<{
      name: string;
      in: string;
      required?: boolean;
    }>;
  } | undefined;

  if (connectorResponse.paths) {
    for (const [path, methods] of Object.entries(connectorResponse.paths)) {
      for (const [method, def] of Object.entries(methods)) {
        if (def.operationId === operationId) {
          operationPath = path;
          httpMethod = method.toUpperCase();
          operationDef = def;
          break;
        }
      }
      if (operationPath) break;
    }
  }

  if (!operationPath || !httpMethod) {
    return {
      operationId,
      success: false,
      error: `Operation '${operationId}' not found in connector '${apiName}'. Use get_connector_swagger to see available operations.`,
    };
  }

  // Replace {connectionId} placeholder with actual connection ID
  const connectionId = connection.id.split("/").pop() ?? connectionName;
  let resolvedPath = operationPath.replace("{connectionId}", connectionId);

  // Build query parameters and path parameters from the provided parameters
  const queryParams: Record<string, string> = {};
  
  if (parameters && operationDef?.parameters) {
    for (const param of operationDef.parameters) {
      const value = parameters[param.name];
      if (value !== undefined) {
        if (param.in === "path") {
          resolvedPath = resolvedPath.replace(`{${param.name}}`, encodeURIComponent(String(value)));
        } else if (param.in === "query") {
          queryParams[param.name] = String(value);
        }
      }
    }
  }

  // Get the runtime URL from the connector
  const connectorMetadata = await armRequest<{
    properties: {
      runtimeUrls?: string[];
    };
  }>(
    `/subscriptions/${subscriptionId}/providers/Microsoft.Web/locations/${location}/managedApis/${apiName}`,
    { queryParams: { "api-version": "2018-07-01-preview" } }
  );

  const runtimeUrl = connectorMetadata.properties.runtimeUrls?.[0];
  if (!runtimeUrl) {
    return {
      operationId,
      success: false,
      error: `No runtime URL found for connector '${apiName}'`,
    };
  }

  // Make the actual call to the connector runtime
  try {
    const token = await getAccessToken();
    const url = new URL(resolvedPath, runtimeUrl);
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      method: httpMethod,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: httpMethod === "POST" && parameters ? JSON.stringify(parameters) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        operationId,
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    return {
      operationId,
      success: true,
      data,
    };
  } catch (error) {
    return {
      operationId,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error invoking operation",
    };
  }
}

export interface CreateConnectionResult {
  connectionName: string;
  location: string;
  status: string;
  portalUrl: string;
  message: string;
}

/**
 * Create a new API connection.
 * For OAuth-based connections, returns a portal URL where the user can authorize.
 */
export async function createConnection(
  subscriptionId: string,
  resourceGroupName: string,
  connectionName: string,
  connectorName: string,
  location: string,
  displayName?: string,
  parameterValues?: Record<string, unknown>
): Promise<CreateConnectionResult> {
  // Build the connection resource
  const connectionBody = {
    location,
    properties: {
      displayName: displayName ?? connectionName,
      api: {
        id: `/subscriptions/${subscriptionId}/providers/Microsoft.Web/locations/${location}/managedApis/${connectorName}`,
      },
      ...(parameterValues && Object.keys(parameterValues).length > 0
        ? { parameterValues }
        : {}),
    },
  };

  // Create the connection
  const response = await armRequest<{
    id: string;
    name: string;
    location: string;
    properties: {
      displayName: string;
      statuses?: Array<{ status: string; error?: { code: string; message: string } }>;
    };
  }>(
    `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/connections/${connectionName}`,
    {
      method: "PUT",
      queryParams: { "api-version": "2018-07-01-preview" },
      body: connectionBody,
    }
  );

  const status = response.properties.statuses?.[0]?.status ?? "Unknown";

  // Azure Portal URL for viewing/editing this connection
  const portalUrl = `https://portal.azure.com/#resource/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/connections/${connectionName}`;

  let message: string;
  if (status === "Connected") {
    message = `Connection '${connectionName}' created successfully and is ready to use.`;
  } else {
    message = `Connection '${connectionName}' created but needs authorization. Open the Azure Portal to authorize: ${portalUrl}`;
  }

  return {
    connectionName: response.name,
    location: response.location,
    status,
    portalUrl,
    message,
  };
}
