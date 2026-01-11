import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpConfig {
  servers?: Record<string, McpServerConfig>;
}

const MCP_SERVER_NAME = 'logicapps';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('logicapps-mcp.configure', configureMcpServer),
    vscode.commands.registerCommand('logicapps-mcp.remove', removeMcpServer)
  );
}

async function configureMcpServer(): Promise<void> {
  const workspaceFolder = await getWorkspaceFolder();
  if (!workspaceFolder) {
    return;
  }

  // Check if npx is available
  const useNpx = await vscode.window.showQuickPick(
    [
      { label: 'npx (recommended)', value: 'npx', description: 'Run directly without global install' },
      { label: 'Global install', value: 'global', description: 'Use globally installed package' }
    ],
    { placeHolder: 'How would you like to run the MCP server?' }
  );

  if (!useNpx) {
    return;
  }

  let serverConfig: McpServerConfig;

  if (useNpx.value === 'npx') {
    serverConfig = {
      command: 'npx',
      args: ['-y', 'logicapps-mcp']
    };
  } else {
    serverConfig = {
      command: 'logicapps-mcp'
    };
  }

  // Ask about optional environment variables
  const configureEnv = await vscode.window.showQuickPick(
    [
      { label: 'Use defaults', value: false },
      { label: 'Configure environment variables', value: true }
    ],
    { placeHolder: 'Would you like to configure environment variables?' }
  );

  if (configureEnv?.value) {
    const env: Record<string, string> = {};

    const cacheEnabled = await vscode.window.showQuickPick(
      ['true', 'false'],
      { placeHolder: 'Enable caching? (LOGICAPPS_CACHE_ENABLED)' }
    );
    if (cacheEnabled) {
      env['LOGICAPPS_CACHE_ENABLED'] = cacheEnabled;
    }

    const cacheTtl = await vscode.window.showInputBox({
      prompt: 'Cache TTL in seconds (LOGICAPPS_CACHE_TTL)',
      placeHolder: '300',
      validateInput: (value) => {
        if (value && isNaN(parseInt(value))) {
          return 'Please enter a valid number';
        }
        return null;
      }
    });
    if (cacheTtl) {
      env['LOGICAPPS_CACHE_TTL'] = cacheTtl;
    }

    if (Object.keys(env).length > 0) {
      serverConfig.env = env;
    }
  }

  await updateMcpConfig(workspaceFolder, serverConfig);

  vscode.window.showInformationMessage(
    'Logic Apps MCP Server configured! Restart VS Code or reload the window to activate.',
    'Reload Window'
  ).then((selection) => {
    if (selection === 'Reload Window') {
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  });
}

async function removeMcpServer(): Promise<void> {
  const workspaceFolder = await getWorkspaceFolder();
  if (!workspaceFolder) {
    return;
  }

  const mcpConfigPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'mcp.json');

  if (!fs.existsSync(mcpConfigPath)) {
    vscode.window.showInformationMessage('No MCP configuration found.');
    return;
  }

  const content = fs.readFileSync(mcpConfigPath, 'utf-8');
  const config: McpConfig = JSON.parse(content);

  if (!config.servers?.[MCP_SERVER_NAME]) {
    vscode.window.showInformationMessage('Logic Apps MCP Server is not configured.');
    return;
  }

  delete config.servers[MCP_SERVER_NAME];

  if (Object.keys(config.servers).length === 0) {
    delete config.servers;
  }

  if (Object.keys(config).length === 0) {
    fs.unlinkSync(mcpConfigPath);
  } else {
    fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));
  }

  vscode.window.showInformationMessage('Logic Apps MCP Server configuration removed.');
}

async function getWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('Please open a workspace folder first.');
    return undefined;
  }

  if (workspaceFolders.length === 1) {
    return workspaceFolders[0];
  }

  const selected = await vscode.window.showWorkspaceFolderPick({
    placeHolder: 'Select workspace folder for MCP configuration'
  });

  return selected;
}

async function updateMcpConfig(
  workspaceFolder: vscode.WorkspaceFolder,
  serverConfig: McpServerConfig
): Promise<void> {
  const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
  const mcpConfigPath = path.join(vscodeDir, 'mcp.json');

  // Ensure .vscode directory exists
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }

  let config: McpConfig = {};

  // Read existing config if it exists
  if (fs.existsSync(mcpConfigPath)) {
    try {
      const content = fs.readFileSync(mcpConfigPath, 'utf-8');
      config = JSON.parse(content);
    } catch {
      // If parsing fails, start fresh
      config = {};
    }
  }

  // Initialize servers object if needed
  if (!config.servers) {
    config.servers = {};
  }

  // Add or update the logicapps server
  config.servers[MCP_SERVER_NAME] = serverConfig;

  // Write the config
  fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2));
}

export function deactivate() {}
