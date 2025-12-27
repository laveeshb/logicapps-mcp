#!/usr/bin/env node

/**
 * CLI for setting up Logic Apps MCP server with AI assistants.
 *
 * Usage:
 *   npx @laveeshb/logicapps-mcp setup --assistant=copilot
 *   npx @laveeshb/logicapps-mcp setup --assistant=claude
 *   npx @laveeshb/logicapps-mcp setup --assistant=cursor
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Assistant = "copilot" | "claude" | "cursor";

interface SetupConfig {
  mcpConfigPath: string;
  instructionsPath: string;
  mcpConfigContent: object;
}

function getPackageDocsPath(): string {
  // When installed via npm, docs are in the package directory
  // When running from source, they're in the project root
  const packageDocsPath = path.join(__dirname, "..", "docs");
  if (fs.existsSync(packageDocsPath)) {
    return packageDocsPath;
  }
  // Fallback to source location
  return path.join(__dirname, "..", "..", "docs");
}

function getAgentInstructions(): string {
  const docsPath = getPackageDocsPath();
  const mainDocPath = path.join(docsPath, "logic-apps-assistant.md");

  if (fs.existsSync(mainDocPath)) {
    return fs.readFileSync(mainDocPath, "utf-8");
  }

  // Fallback minimal instructions
  return `# Logic Apps AI Assistant

An intelligent assistant for Azure Logic Apps using MCP tools.

## Quick Start

- \`list_logic_apps\` - Find Logic Apps
- \`search_runs\` - Find workflow runs
- \`get_run_actions\` - Debug failures
- \`get_workflow_definition\` - View workflow
- \`create_workflow\` / \`update_workflow\` - Modify workflows

For full documentation, see: https://github.com/laveeshb/logicapps-mcp
`;
}

function getSetupConfig(assistant: Assistant, cwd: string): SetupConfig {
  const mcpConfig = {
    servers: {
      logicapps: {
        type: "stdio",
        command: "npx",
        args: ["@laveeshb/logicapps-mcp"],
      },
    },
  };

  switch (assistant) {
    case "copilot":
      return {
        mcpConfigPath: path.join(cwd, ".vscode", "mcp.json"),
        instructionsPath: path.join(cwd, ".github", "copilot-instructions.md"),
        mcpConfigContent: mcpConfig,
      };

    case "cursor":
      return {
        mcpConfigPath: path.join(cwd, ".cursor", "mcp.json"),
        instructionsPath: path.join(cwd, ".cursor", "rules"),
        mcpConfigContent: {
          mcpServers: {
            logicapps: {
              command: "npx",
              args: ["@laveeshb/logicapps-mcp"],
            },
          },
        },
      };

    case "claude":
      // Claude Desktop config is global, not per-project
      const homeDir =
        process.env.HOME ||
        process.env.USERPROFILE ||
        process.env.HOMEPATH ||
        "";
      const isWindows = process.platform === "win32";
      const claudeConfigDir = isWindows
        ? path.join(process.env.APPDATA || homeDir, "Claude")
        : path.join(homeDir, "Library", "Application Support", "Claude");

      return {
        mcpConfigPath: path.join(claudeConfigDir, "claude_desktop_config.json"),
        instructionsPath: "", // Claude uses project custom instructions in UI
        mcpConfigContent: {
          mcpServers: {
            logicapps: {
              command: "npx",
              args: ["@laveeshb/logicapps-mcp"],
            },
          },
        },
      };
  }
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function mergeConfig(existing: object, newConfig: object): object {
  // Deep merge, preserving existing servers
  const merged = { ...existing };
  for (const [key, value] of Object.entries(newConfig)) {
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      key in merged
    ) {
      (merged as Record<string, unknown>)[key] = mergeConfig(
        (merged as Record<string, unknown>)[key] as object,
        value
      );
    } else {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

function setupAssistant(assistant: Assistant, cwd: string): void {
  const config = getSetupConfig(assistant, cwd);

  console.log(`\n🔧 Setting up Logic Apps MCP for ${assistant}...\n`);

  // 1. Create/update MCP config
  ensureDir(config.mcpConfigPath);

  let mcpConfig = config.mcpConfigContent;
  if (fs.existsSync(config.mcpConfigPath)) {
    try {
      const existing = JSON.parse(
        fs.readFileSync(config.mcpConfigPath, "utf-8")
      );
      mcpConfig = mergeConfig(existing, config.mcpConfigContent);
      console.log(`✓ Updated ${config.mcpConfigPath}`);
    } catch {
      console.log(`✓ Created ${config.mcpConfigPath}`);
    }
  } else {
    console.log(`✓ Created ${config.mcpConfigPath}`);
  }

  fs.writeFileSync(config.mcpConfigPath, JSON.stringify(mcpConfig, null, 2));

  // 2. Create agent instructions (if applicable)
  if (config.instructionsPath) {
    ensureDir(config.instructionsPath);
    const instructions = getAgentInstructions();
    fs.writeFileSync(config.instructionsPath, instructions);
    console.log(`✓ Created ${config.instructionsPath}`);
  }

  // 3. Print next steps
  console.log(`\n✅ Setup complete!\n`);

  if (assistant === "claude") {
    console.log(`📝 Next steps for Claude Desktop:`);
    console.log(`   1. Restart Claude Desktop`);
    console.log(
      `   2. Create a Project and add custom instructions from:`
    );
    console.log(`      https://github.com/laveeshb/logicapps-mcp/docs/logic-apps-assistant.md`);
  } else {
    console.log(`📝 Next steps:`);
    console.log(`   1. Restart ${assistant === "copilot" ? "VS Code" : "Cursor"}`);
    console.log(`   2. Open the AI chat and try: "List my Logic Apps"`);
  }

  console.log(`\n💡 Make sure you're logged into Azure: az login\n`);
}

function printUsage(): void {
  console.log(`
Logic Apps MCP Server - Setup CLI

Usage:
  npx @laveeshb/logicapps-mcp setup --assistant=<name>

Options:
  --assistant=copilot   Set up for GitHub Copilot (VS Code)
  --assistant=cursor    Set up for Cursor
  --assistant=claude    Set up for Claude Desktop

Examples:
  npx @laveeshb/logicapps-mcp setup --assistant=copilot
  npx @laveeshb/logicapps-mcp setup --assistant=cursor

This creates:
  - MCP server configuration
  - Agent instructions with Logic Apps expertise
`);
}

export function runSetupCLI(args: string[]): void {
  const setupIndex = args.indexOf("setup");
  if (setupIndex === -1) {
    return; // Not a setup command
  }

  const assistantArg = args.find((arg) => arg.startsWith("--assistant="));
  if (!assistantArg) {
    printUsage();
    process.exit(1);
  }

  const assistant = assistantArg.split("=")[1] as Assistant;
  if (!["copilot", "cursor", "claude"].includes(assistant)) {
    console.error(`❌ Unknown assistant: ${assistant}`);
    console.error(`   Valid options: copilot, cursor, claude`);
    process.exit(1);
  }

  const cwd = process.cwd();
  setupAssistant(assistant, cwd);
  process.exit(0);
}
