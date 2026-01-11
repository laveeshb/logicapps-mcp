# Azure Logic Apps MCP Server for VS Code

Configure the [Azure Logic Apps MCP Server](https://github.com/laveeshb/logicapps-mcp) for use with GitHub Copilot Chat.

## Features

- **One-click setup**: Automatically configures the MCP server in your workspace
- **Flexible installation**: Choose between `npx` (no install needed) or global installation
- **Environment configuration**: Optionally configure caching and other settings

## Usage

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **"Logic Apps: Configure Logic Apps MCP Server"**
3. Choose your preferred installation method
4. Reload VS Code when prompted

Once configured, you can use the Logic Apps tools in GitHub Copilot Chat by mentioning `@logicapps` or using agent mode.

## Commands

| Command | Description |
|---------|-------------|
| `Logic Apps: Configure Logic Apps MCP Server` | Set up the MCP server in your workspace |
| `Logic Apps: Remove Logic Apps MCP Server Configuration` | Remove the MCP server configuration |

## Requirements

- VS Code 1.96.0 or later
- GitHub Copilot Chat extension
- Azure CLI (`az login`) for authentication

## What gets created

The extension creates or updates `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "logicapps": {
      "command": "npx",
      "args": ["-y", "@anthropic/logicapps-mcp@latest"]
    }
  }
}
```

## Available Tools

Once configured, the MCP server provides 40 tools for Azure Logic Apps:

- **Discovery**: List subscriptions, Logic Apps, workflows
- **Debugging**: View run history, action details, expression traces
- **Operations**: Create, update, enable/disable workflows
- **Connections**: Manage API connections, test connectivity

See the [full tool catalog](https://github.com/laveeshb/logicapps-mcp#tools) for details.

## License

MIT
