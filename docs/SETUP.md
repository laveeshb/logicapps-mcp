# Setup Guide

How to configure the Logic Apps MCP server with different AI clients.

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

Restart VS Code and the tools will be available in Copilot Chat.

---

## Claude Desktop

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

Restart Claude Desktop and the tools will be available.

---

## Cursor

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

---

## Verification

After setup, test with these prompts:

1. **Discovery:** "List all Logic Apps in my subscription"
2. **Debugging:** "Why did my workflow fail?"
3. **Authoring:** "Create a Logic App that sends an email when a blob is uploaded"

The client should invoke MCP tools like `list_logic_apps`, `search_runs`, etc.

---

## Troubleshooting Setup

### "Tool not found" or no MCP tools available

1. Check MCP server is installed: `npx @laveeshb/logicapps-mcp --version`
2. Verify config file path is correct
3. Restart the AI client/VS Code

### "Unauthorized" errors

1. Check Azure CLI auth: `az account show`
2. Re-authenticate: `az login`
3. Verify RBAC permissions on Logic Apps

---

## Knowledge Tools

The MCP server includes 3 knowledge tools that provide guidance on demand:

| Tool | Purpose |
|------|---------|
| `get_troubleshooting_guide` | Debugging patterns for expression errors, connection issues, run failures |
| `get_authoring_guide` | Workflow patterns, connector examples, deployment guides |
| `get_reference` | Tool catalog, SKU differences |

These tools return bundled documentation, so no additional setup is required for the AI to understand Logic Apps concepts.
