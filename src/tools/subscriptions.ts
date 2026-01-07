/**
 * List accessible Azure subscriptions.
 */

import { armRequest } from "../utils/http.js";

interface SubscriptionResponse {
  subscriptionId: string;
  displayName: string;
  state: string;
  tenantId: string;
}

export interface SubscriptionResult {
  subscriptions: Array<{
    subscriptionId: string;
    displayName: string;
    state: string;
  }>;
  nextLink?: string;
}

export async function listSubscriptions(): Promise<SubscriptionResult> {
  const response = await armRequest<{ value: SubscriptionResponse[]; nextLink?: string }>(
    "/subscriptions",
    { queryParams: { "api-version": "2022-12-01" } }
  );

  const subscriptions = response.value ?? [];

  return {
    subscriptions: subscriptions.map((sub) => ({
      subscriptionId: sub.subscriptionId,
      displayName: sub.displayName,
      state: sub.state,
    })),
    nextLink: response.nextLink,
  };
}
