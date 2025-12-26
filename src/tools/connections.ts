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
  interface ConnectorResponse {
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
      apiDefinitions?: {
        originalSwaggerUrl?: string;
        modifiedSwaggerUrl?: string;
      };
    };
  }

  // Try to get the connector with swagger export
  const connector = await armRequest<ConnectorResponse>(
    `/subscriptions/${subscriptionId}/providers/Microsoft.Web/locations/${location}/managedApis/${connectorName}`,
    { queryParams: { "api-version": "2016-06-01", "export": "true" } }
  );

  const result: GetConnectorSwaggerResult = {
    connectorName: connector.name,
    displayName: connector.properties.generalInformation?.displayName ?? connector.name,
    description: connector.properties.generalInformation?.description ?? "",
    iconUri: connector.properties.generalInformation?.iconUrl,
    capabilities: connector.properties.capabilities,
    connectionParameters: connector.properties.connectionParameters,
  };

  // If swagger was included in the response, add it
  if (connector.properties.swagger) {
    result.swagger = connector.properties.swagger;
  }

  // If no swagger but there's a swagger URL, try to fetch it
  if (!result.swagger && connector.properties.apiDefinitions?.modifiedSwaggerUrl) {
    try {
      const token = await getAccessToken();
      const swaggerResponse = await fetch(connector.properties.apiDefinitions.modifiedSwaggerUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (swaggerResponse.ok) {
        result.swagger = await swaggerResponse.json() as GetConnectorSwaggerResult["swagger"];
      }
    } catch {
      // Swagger fetch failed, continue without it
    }
  }

  return result;
}
