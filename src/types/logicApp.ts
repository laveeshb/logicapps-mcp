/**
 * Type definitions for Logic Apps resources.
 */

// Consumption Logic App (Microsoft.Logic/workflows)
export interface ConsumptionLogicApp {
  id: string;
  name: string;
  type: "Microsoft.Logic/workflows";
  location: string;
  properties: {
    state: "Enabled" | "Disabled";
    createdTime: string;
    changedTime: string;
    definition: WorkflowDefinition;
    parameters?: Record<string, unknown>;
  };
  tags?: Record<string, string>;
}

// Standard Logic App (Microsoft.Web/sites with kind workflowapp)
export interface StandardLogicApp {
  id: string;
  name: string;
  type: "Microsoft.Web/sites";
  kind: string; // "functionapp,workflowapp" or similar
  location: string;
  properties: {
    state: "Running" | "Stopped";
    defaultHostName: string;
    enabled: boolean;
  };
  tags?: Record<string, string>;
}

// Unified Logic App representation
export interface LogicApp {
  id: string;
  name: string;
  resourceGroup: string;
  location: string;
  sku: "consumption" | "standard";
  state: string;
  createdTime?: string;
  changedTime?: string;
  workflowCount?: number; // For Standard SKU
  tags?: Record<string, string>;
}

// Workflow definition structure
export interface WorkflowDefinition {
  $schema: string;
  contentVersion: string;
  parameters?: Record<string, unknown>;
  triggers?: Record<string, Trigger>;
  actions?: Record<string, Action>;
  outputs?: Record<string, unknown>;
}

export interface Trigger {
  type: string;
  kind?: string;
  inputs?: Record<string, unknown>;
  recurrence?: {
    frequency: string;
    interval: number;
  };
}

export interface Action {
  type: string;
  inputs?: Record<string, unknown>;
  runAfter?: Record<string, string[]>;
}

// Workflow run
export interface WorkflowRun {
  id: string;
  name: string;
  type: string;
  properties: {
    status: "Running" | "Waiting" | "Succeeded" | "Failed" | "Cancelled" | "Skipped";
    startTime: string;
    endTime?: string;
    trigger?: {
      name: string;
      inputsLink?: { uri: string };
      outputsLink?: { uri: string };
    };
    correlation?: {
      clientTrackingId: string;
    };
    error?: {
      code: string;
      message: string;
    };
  };
}

// Run action
export interface RunAction {
  id: string;
  name: string;
  type: string;
  properties: {
    status: "Succeeded" | "Failed" | "Skipped" | "Waiting" | "Running";
    startTime: string;
    endTime?: string;
    inputsLink?: { uri: string };
    outputsLink?: { uri: string };
    error?: {
      code: string;
      message: string;
    };
    trackedProperties?: Record<string, unknown>;
  };
}

// Trigger state
export interface TriggerState {
  id: string;
  name: string;
  type: string;
  properties: {
    provisioningState: string;
    createdTime: string;
    changedTime: string;
    state: "Enabled" | "Disabled";
    lastExecutionTime?: string;
    nextExecutionTime?: string;
  };
}

// API Connection
export interface ApiConnection {
  id: string;
  name: string;
  type: "Microsoft.Web/connections";
  location: string;
  properties: {
    displayName: string;
    statuses: Array<{ status: string }>;
    api: {
      name: string;
      displayName: string;
    };
    createdTime: string;
  };
}

// Standard workflow (from Workflow Management API - list/get endpoints)
export interface StandardWorkflow {
  name: string;
  kind: string;
  href?: string;
  definition_href?: string;
  isDisabled?: boolean;
  health?: {
    state: string;
  };
  triggers?: Record<string, { type: string; kind?: string }>;
}

// Standard workflow definition file (from management API PUT/GET)
export interface StandardWorkflowDefinitionFile {
  definition: WorkflowDefinition;
  kind: string;
  runtimeConfiguration?: Record<string, unknown>;
}

// Standard workflow update payload (for PUT operations)
export interface StandardWorkflowUpdatePayload {
  properties: {
    files: {
      "workflow.json": StandardWorkflowDefinitionFile;
    };
    health?: {
      state: string;
    };
    isDisabled?: boolean;
  };
}

// Host status (Standard SKU only - from /admin/host/status)
export interface HostStatus {
  id: string;
  state: string;
  version: string;
  versionDetails?: string;
  platformVersion?: string;
  instanceId?: string;
  computerName?: string;
  processUptime?: number;
  extensionBundle?: {
    id: string;
    version: string;
  };
}

// Workflow version (Consumption SKU only)
export interface WorkflowVersion {
  id: string;
  name: string;
  type: string;
  location: string;
  properties: {
    provisioningState: string;
    createdTime: string;
    changedTime: string;
    state: "Enabled" | "Disabled";
    version: string;
    definition: WorkflowDefinition;
    parameters?: Record<string, unknown>;
  };
}
