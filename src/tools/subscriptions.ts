/**
 * List accessible Azure subscriptions.
 */

import { armRequestAllPages } from "../utils/http.js";

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
}

export async function listSubscriptions(): Promise<SubscriptionResult> {
  const subscriptions = await armRequestAllPages<SubscriptionResponse>("/subscriptions", {
    "api-version": "2022-12-01",
  });

  return {
    subscriptions: subscriptions.map((sub) => ({
      subscriptionId: sub.subscriptionId,
      displayName: sub.displayName,
      state: sub.state,
    })),
  };
}
