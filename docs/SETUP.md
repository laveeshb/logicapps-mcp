# Setup Guide

How to configure the Logic Apps MCP server with different AI assistants.

---

## Prerequisites

1. **Install the MCP server:**
   ```bash
   npm install -g @laveeshb/logicapps-mcp
   # Or run from source: npm run build
   ```

2. **Azure authentication:**
   ```bash
   az login
   ```

---

## GitHub Copilot (VS Code)

### Configure MCP Server

Create or edit `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "logicapps": {
      "type": "stdio",
      "command": "npx",
      "args": ["@laveeshb/logicapps-mcp"]
    }
  }
}
```

Or if running from local source:
```json
{
  "servers": {
    "logicapps": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/logicapps-mcp/dist/index.js"]
    }
  }
}
```

### Add Agent Instructions

Copy `docs/logic-apps-assistant.md` to `.github/copilot-instructions.md`:
```bash
cp docs/logic-apps-assistant.md .github/copilot-instructions.md
```

Copilot automatically reads this file for context.

### Verify Setup

1. Open Copilot Chat
2. Ask: "List my Logic Apps"
3. Copilot should use the `list_logic_apps` tool

---

## Claude Desktop

### Configure MCP Server

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or 
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "logicapps": {
      "command": "npx",
      "args": ["@laveeshb/logicapps-mcp"]
    }
  }
}
```

### Add Agent Instructions

In Claude Desktop, create a Project and add custom instructions by pasting the content of `docs/logic-apps-assistant.md`.

Or configure a file system server to give Claude access to the docs folder.

---

## Cursor

### Configure MCP Server

Edit `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "logicapps": {
      "command": "npx",
      "args": ["@laveeshb/logicapps-mcp"]
    }
  }
}
```

### Add Agent Instructions

Create `.cursor/rules` and paste the content of `docs/logic-apps-assistant.md`.

---

## Verification

After setup, test with these prompts:

1. **Discovery:** "List all Logic Apps in my subscription"
2. **Debugging:** "Why did my workflow fail?"
3. **Authoring:** "Create a Logic App that sends an email when a blob is uploaded"

The assistant should invoke MCP tools like `list_logic_apps`, `search_runs`, etc.

---

## Troubleshooting Setup

### "Tool not found" or no MCP tools available

1. Check MCP server is installed: `npx @laveeshb/logicapps-mcp --version`
2. Verify config file path is correct
3. Restart the AI assistant/VS Code

### "Unauthorized" errors

1. Check Azure CLI auth: `az account show`
2. Re-authenticate: `az login`
3. Verify RBAC permissions on Logic Apps

### Tools work but agent doesn't use them well

1. Ensure agent instructions are loaded (`.github/copilot-instructions.md` for Copilot)
2. Be explicit: "Use the search_runs tool to find failed runs"
3. Check for doc file in correct location

---

## File Locations Summary

| Assistant | MCP Config | Agent Instructions |
|-----------|-----------|-------------------|
| VS Code Copilot | `.vscode/mcp.json` | `.github/copilot-instructions.md` |
| Claude Desktop | `~/...Claude/claude_desktop_config.json` | Project custom instructions |
| Cursor | `.cursor/mcp.json` | `.cursor/rules` |
