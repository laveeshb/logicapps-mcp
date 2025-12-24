/**
 * API Connection operations.
 */

import { armRequestAllPages } from "../utils/http.js";
import { ApiConnection } from "../types/logicApp.js";

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
