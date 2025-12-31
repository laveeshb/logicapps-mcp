/**
 * Batch operations for Logic Apps workflows and runs.
 * Uses controlled concurrency to avoid Azure throttling.
 */

import { cancelRun } from "./runs.js";
import { enableWorkflow, disableWorkflow } from "./workflows.js";

// ============================================================================
// Concurrency Control
// ============================================================================

/**
 * Execute promises with controlled concurrency.
 * @param items Items to process
 * @param fn Async function to apply to each item
 * @param concurrency Maximum concurrent operations (default: 5, minimum: 1)
 */
async function withConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  // Ensure concurrency is at least 1
  const effectiveConcurrency = Math.max(1, concurrency);

  const results: R[] = new Array(items.length);
  const executing: Set<Promise<void>> = new Set();

  for (let i = 0; i < items.length; i++) {
    const index = i;
    const item = items[i];

    const promise = fn(item)
      .then((result) => {
        results[index] = result;
      })
      .finally(() => {
        executing.delete(promise);
      });

    executing.add(promise);

    if (executing.size >= effectiveConcurrency) {
      // Wait for at least one to complete, ignore rejections here
      // (they'll be caught when we await Promise.all)
      await Promise.race(executing).catch(() => {});
    }
  }

  // Wait for remaining promises - this will throw if any rejected
  await Promise.all(executing);

  return results;
}

// ============================================================================
// Types
// ============================================================================

interface BatchItemResult {
  id: string;
  success: boolean;
  error?: string;
}

interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchItemResult[];
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Cancel multiple workflow runs.
 */
export async function cancelRuns(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  runIds: string[],
  workflowName?: string,
  concurrency: number = 5
): Promise<BatchResult> {
  const results = await withConcurrency(
    runIds,
    async (runId): Promise<BatchItemResult> => {
      try {
        await cancelRun(subscriptionId, resourceGroupName, logicAppName, runId, workflowName);
        return { id: runId, success: true };
      } catch (error) {
        return {
          id: runId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    concurrency
  );

  const succeeded = results.filter((r) => r.success).length;

  return {
    total: runIds.length,
    succeeded,
    failed: runIds.length - succeeded,
    results,
  };
}

/**
 * Enable multiple workflows.
 * For Standard SKU, provide workflowNames. For Consumption, provide logicAppNames.
 */
export async function batchEnableWorkflows(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowNames: string[],
  concurrency: number = 5
): Promise<BatchResult> {
  const results = await withConcurrency(
    workflowNames,
    async (workflowName): Promise<BatchItemResult> => {
      try {
        await enableWorkflow(subscriptionId, resourceGroupName, logicAppName, workflowName);
        return { id: workflowName, success: true };
      } catch (error) {
        return {
          id: workflowName,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    concurrency
  );

  const succeeded = results.filter((r) => r.success).length;

  return {
    total: workflowNames.length,
    succeeded,
    failed: workflowNames.length - succeeded,
    results,
  };
}

/**
 * Disable multiple workflows.
 * For Standard SKU, provide workflowNames. For Consumption, provide logicAppNames.
 */
export async function batchDisableWorkflows(
  subscriptionId: string,
  resourceGroupName: string,
  logicAppName: string,
  workflowNames: string[],
  concurrency: number = 5
): Promise<BatchResult> {
  const results = await withConcurrency(
    workflowNames,
    async (workflowName): Promise<BatchItemResult> => {
      try {
        await disableWorkflow(subscriptionId, resourceGroupName, logicAppName, workflowName);
        return { id: workflowName, success: true };
      } catch (error) {
        return {
          id: workflowName,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    concurrency
  );

  const succeeded = results.filter((r) => r.success).length;

  return {
    total: workflowNames.length,
    succeeded,
    failed: workflowNames.length - succeeded,
    results,
  };
}
