/**
 * Knowledge tools that provide access to bundled documentation.
 * These help the AI understand how to use Logic Apps effectively.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Docs are bundled relative to the dist folder
// In development: src/tools -> docs (../../docs)
// In production: dist/tools -> docs (../../docs)
const DOCS_ROOT = join(__dirname, "..", "..", "docs");

/**
 * Valid topics for troubleshooting guides
 */
export type TroubleshootingTopic = 
  | "expression-errors"
  | "connection-issues"
  | "run-failures"
  | "known-limitations";

/**
 * Valid topics for authoring guides
 */
export type AuthoringTopic = 
  | "workflow-patterns"
  | "connector-patterns"
  | "deployment";

/**
 * Valid topics for reference guides
 */
export type ReferenceTopic = 
  | "tool-catalog"
  | "sku-differences";

/**
 * Read a documentation file from the bundled docs folder.
 */
function readDocFile(relativePath: string): string {
  const fullPath = join(DOCS_ROOT, relativePath);
  
  if (!existsSync(fullPath)) {
    throw new Error(`Documentation file not found: ${relativePath}. Looking in: ${fullPath}`);
  }
  
  return readFileSync(fullPath, "utf-8");
}

/**
 * Get troubleshooting guidance for Logic Apps issues.
 * 
 * @param topic - The troubleshooting topic to retrieve
 * @returns The markdown content of the troubleshooting guide
 */
export function getTroubleshootingGuide(topic: TroubleshootingTopic): { topic: string; content: string } {
  const validTopics: TroubleshootingTopic[] = [
    "expression-errors",
    "connection-issues", 
    "run-failures",
    "known-limitations",
  ];
  
  if (!validTopics.includes(topic)) {
    throw new Error(`Invalid troubleshooting topic: ${topic}. Valid topics: ${validTopics.join(", ")}`);
  }
  
  const content = readDocFile(join("troubleshooting", `${topic}.md`));
  
  return {
    topic,
    content,
  };
}

/**
 * Get authoring guidance for creating Logic Apps workflows.
 * 
 * @param topic - The authoring topic to retrieve
 * @returns The markdown content of the authoring guide
 */
export function getAuthoringGuide(topic: AuthoringTopic): { topic: string; content: string } {
  const validTopics: AuthoringTopic[] = [
    "workflow-patterns",
    "connector-patterns",
    "deployment",
  ];
  
  if (!validTopics.includes(topic)) {
    throw new Error(`Invalid authoring topic: ${topic}. Valid topics: ${validTopics.join(", ")}`);
  }
  
  const content = readDocFile(join("authoring", `${topic}.md`));
  
  return {
    topic,
    content,
  };
}

/**
 * Get reference documentation for Logic Apps.
 * 
 * @param topic - The reference topic to retrieve
 * @returns The markdown content of the reference guide
 */
export function getReference(topic: ReferenceTopic): { topic: string; content: string } {
  const validTopics: ReferenceTopic[] = [
    "tool-catalog",
    "sku-differences",
  ];
  
  if (!validTopics.includes(topic)) {
    throw new Error(`Invalid reference topic: ${topic}. Valid topics: ${validTopics.join(", ")}`);
  }
  
  const content = readDocFile(join("reference", `${topic}.md`));
  
  return {
    topic,
    content,
  };
}
