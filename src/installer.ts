#!/usr/bin/env node

/**
 * MCP Context Saver Installer Script
 * Automates the process of wrapping MCP servers with intelligent LLM coordination
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { homedir } from 'os';
import { analyzeServer } from './analyzer.js';
import { z } from 'zod';

const exec = promisify(execCallback);

// Configuration paths for different AI agents
const CONFIG_PATHS = {
  claudeDesktop: {
    macos: path.join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    windows: path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json'),
    linux: path.join(homedir(), '.config', 'Claude', 'claude_desktop_config.json')
  },
  claudeCode: '.mcp/config.json',
  vscode: '.vscode/mcp.json'
};

// Schema for validating MCP server paths
const ServerPathSchema = z.object({
  path: z.string(),
  args: z.array(z.string()).optional(),
  name: z.string().optional()
});

interface InstallerOptions {
  server?: string;
  agent?: string;
  config?: string;
  skipAnalysis?: boolean;
  interactive?: boolean;
}

class MCPInstaller {
  private configDir: string;
  private spinner: Ora;

  constructor() {
    this.configDir = path.join(process.cwd(), 'configs');
    this.spinner = ora();
  }

  async run(options: InstallerOptions): Promise<void> {
    console.log(chalk.blue.bold('\n🚀 MCP Context Saver Installer\n'));

    try {
      // Ensure config directory exists
      await this.ensureConfigDir();

      // Check for OpenAI API key
      await this.checkApiKey();

      // Interactive mode by default unless specific options provided
      if (options.interactive !== false && !options.server) {
        await this.interactiveSetup();
      } else if (options.server) {
        await this.directSetup(options);
      } else {
        await this.showHelp();
      }
    } catch (error) {
      this.spinner.fail(chalk.red(`Installation failed: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }

  private async ensureConfigDir(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private async checkApiKey(): Promise<void> {
    if (!process.env.OPENAI_API_KEY) {
      console.log(chalk.yellow('⚠️  OpenAI API key not found in environment'));
      
      const { hasKey } = await inquirer.prompt([{
        type: 'confirm',
        name: 'hasKey',
        message: 'Do you have an OpenAI API key?',
        default: false
      }]);

      if (!hasKey) {
        console.log(chalk.cyan('\nTo get an API key:'));
        console.log('1. Visit https://platform.openai.com/api-keys');
        console.log('2. Sign in or create an account');
        console.log('3. Generate a new API key');
        console.log('4. Set it as an environment variable:');
        console.log(chalk.green('   export OPENAI_API_KEY=your-key-here'));
        process.exit(0);
      }

      const { apiKey } = await inquirer.prompt([{
        type: 'password',
        name: 'apiKey',
        message: 'Enter your OpenAI API key:',
        validate: (input) => input.length > 0 || 'API key is required'
      }]);

      process.env.OPENAI_API_KEY = apiKey;
    }
  }

  private async interactiveSetup(): Promise<void> {
    const { setupMode } = await inquirer.prompt([{
      type: 'list',
      name: 'setupMode',
      message: 'What would you like to do?',
      choices: [
        { name: '🔍 Discover and wrap available MCP servers', value: 'discover' },
        { name: '📦 Wrap a specific MCP server', value: 'specific' },
        { name: '⚙️  Configure existing wrapper for an AI agent', value: 'configure' },
        { name: '📚 Show available MCP servers in npm registry', value: 'registry' },
        { name: '❓ Help', value: 'help' }
      ]
    }]);

    switch (setupMode) {
      case 'discover':
        await this.discoverServers();
        break;
      case 'specific':
        await this.wrapSpecificServer();
        break;
      case 'configure':
        await this.configureAgent();
        break;
      case 'registry':
        await this.showRegistryServers();
        break;
      case 'help':
        await this.showHelp();
        break;
    }
  }

  private async discoverServers(): Promise<void> {
    this.spinner.start('Discovering installed MCP servers...');

    const servers: Array<{ path: string; name: string; type: string }> = [];

    // Check for globally installed npm packages
    try {
      const { stdout } = await exec('npm list -g --depth=0 --json');
      const globalPackages = JSON.parse(stdout);
      
      for (const [name, info] of Object.entries(globalPackages.dependencies || {})) {
        if (name.includes('mcp') || name.includes('modelcontextprotocol')) {
          servers.push({
            path: name,
            name: name,
            type: 'npm-global'
          });
        }
      }
    } catch (error) {
      // npm list might fail if no global packages
    }

    // Check local node_modules
    try {
      const localPath = path.join(process.cwd(), 'node_modules');
      const dirs = await fs.readdir(localPath);
      
      for (const dir of dirs) {
        if (dir.includes('mcp') || dir.includes('modelcontextprotocol')) {
          const packagePath = path.join(localPath, dir, 'package.json');
          try {
            const pkg = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
            if (pkg.bin || pkg.main?.includes('server')) {
              servers.push({
                path: path.join(localPath, dir),
                name: pkg.name,
                type: 'npm-local'
              });
            }
          } catch {
            // Skip if can't read package.json
          }
        }
      }
    } catch (error) {
      // node_modules might not exist
    }

    // Check for local server files
    try {
      const files = await fs.readdir(process.cwd());
      for (const file of files) {
        if (file.includes('server') && (file.endsWith('.js') || file.endsWith('.ts'))) {
          servers.push({
            path: path.join(process.cwd(), file),
            name: file,
            type: 'local-file'
          });
        }
      }
    } catch (error) {
      // Error reading directory
    }

    this.spinner.stop();

    if (servers.length === 0) {
      console.log(chalk.yellow('No MCP servers found locally.'));
      const { install } = await inquirer.prompt([{
        type: 'confirm',
        name: 'install',
        message: 'Would you like to install an MCP server from npm?',
        default: true
      }]);

      if (install) {
        await this.showRegistryServers();
      }
      return;
    }

    console.log(chalk.green(`\nFound ${servers.length} potential MCP server(s):\n`));

    const { selectedServer } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedServer',
      message: 'Select a server to wrap:',
      choices: servers.map(s => ({
        name: `${s.name} (${s.type})`,
        value: s
      }))
    }]);

    await this.analyzeAndWrap(selectedServer.path, selectedServer.name);
  }

  private async wrapSpecificServer(): Promise<void> {
    const { serverPath } = await inquirer.prompt([{
      type: 'input',
      name: 'serverPath',
      message: 'Enter the path to your MCP server:',
      validate: async (input) => {
        try {
          await fs.access(input);
          return true;
        } catch {
          return 'File not found. Please enter a valid path.';
        }
      }
    }]);

    const { serverArgs } = await inquirer.prompt([{
      type: 'input',
      name: 'serverArgs',
      message: 'Enter any arguments for the server (space-separated, or press Enter for none):',
      default: ''
    }]);

    const args = serverArgs ? serverArgs.split(' ').filter(Boolean) : [];
    await this.analyzeAndWrap(serverPath, path.basename(serverPath), args);
  }

  private async analyzeAndWrap(serverPath: string, serverName: string, args: string[] = []): Promise<void> {
    console.log(chalk.cyan(`\n📊 Analyzing ${serverName}...\n`));

    this.spinner.start('Connecting to server and discovering capabilities...');

    try {
      // Use the existing analyzer
      const result = await analyzeServer(serverPath, args);
      
      this.spinner.succeed('Analysis complete!');
      
      console.log(chalk.green('\n✅ Wrapper configuration created successfully!'));
      console.log(chalk.dim(`Configuration saved to: ${result.configPath}`));

      // Ask if user wants to configure for an AI agent
      const { configure } = await inquirer.prompt([{
        type: 'confirm',
        name: 'configure',
        message: 'Would you like to configure this wrapper for an AI agent (Claude, VS Code, etc.)?',
        default: true
      }]);

      if (configure) {
        await this.configureAgent(result.configPath);
      } else {
        console.log(chalk.cyan('\nTo use this wrapper:'));
        console.log(chalk.white(`  mcp-context-saver serve ${result.configPath}`));
      }
    } catch (error) {
      this.spinner.fail('Analysis failed');
      throw error;
    }
  }

  private async configureAgent(configPath?: string): Promise<void> {
    // If no config path provided, let user select from existing configs
    if (!configPath) {
      const configs = await this.listConfigs();
      if (configs.length === 0) {
        console.log(chalk.yellow('No wrapper configurations found. Please wrap a server first.'));
        return;
      }

      const { selectedConfig } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedConfig',
        message: 'Select a wrapper configuration:',
        choices: configs.map(c => ({
          name: path.basename(c),
          value: c
        }))
      }]);

      configPath = selectedConfig;
    }

    const { agent } = await inquirer.prompt([{
      type: 'list',
      name: 'agent',
      message: 'Which AI agent would you like to configure?',
      choices: [
        { name: 'Claude Desktop', value: 'claude-desktop' },
        { name: 'Claude Code (VS Code)', value: 'claude-code' },
        { name: 'VS Code MCP Extension', value: 'vscode' },
        { name: 'Custom (show configuration)', value: 'custom' }
      ]
    }]);

    switch (agent) {
      case 'claude-desktop':
        await this.configureClaudeDesktop(configPath!);
        break;
      case 'claude-code':
        await this.configureClaudeCode(configPath!);
        break;
      case 'vscode':
        await this.configureVSCode(configPath!);
        break;
      case 'custom':
        await this.showCustomConfig(configPath!);
        break;
    }
  }

  private async configureClaudeDesktop(configPath: string): Promise<void> {
    const platform = process.platform === 'darwin' ? 'macos' : 
                     process.platform === 'win32' ? 'windows' : 'linux';
    const claudeConfigPath = CONFIG_PATHS.claudeDesktop[platform];

    console.log(chalk.cyan('\n⚙️  Configuring Claude Desktop...\n'));

    // Read existing Claude config or create new one
    let claudeConfig: any = { mcpServers: {} };
    try {
      const existing = await fs.readFile(claudeConfigPath, 'utf-8');
      claudeConfig = JSON.parse(existing);
    } catch {
      // File doesn't exist, use default
    }

    // Read our wrapper config to get the name
    const wrapperConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    const serverName = wrapperConfig.name.toLowerCase().replace(/\s+/g, '-');

    // Add our wrapper to Claude config
    claudeConfig.mcpServers = claudeConfig.mcpServers || {};
    claudeConfig.mcpServers[serverName] = {
      command: 'npx',
      args: ['-y', 'mcp-context-saver', 'serve', path.resolve(configPath)],
      env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'your-api-key-here'
      }
    };

    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(claudeConfigPath), { recursive: true });

    // Write the config
    await fs.writeFile(claudeConfigPath, JSON.stringify(claudeConfig, null, 2));

    console.log(chalk.green('✅ Claude Desktop configured successfully!'));
    console.log(chalk.dim(`Configuration written to: ${claudeConfigPath}`));
    console.log(chalk.yellow('\n⚠️  Please restart Claude Desktop for changes to take effect.'));
    
    if (!process.env.OPENAI_API_KEY) {
      console.log(chalk.red('\n⚠️  Remember to update the OPENAI_API_KEY in the configuration file!'));
    }
  }

  private async configureClaudeCode(configPath: string): Promise<void> {
    console.log(chalk.cyan('\n⚙️  Configuring Claude Code (VS Code)...\n'));

    const mcpDir = path.join(process.cwd(), '.mcp');
    const mcpConfigPath = path.join(mcpDir, 'config.json');

    // Create .mcp directory
    await fs.mkdir(mcpDir, { recursive: true });

    // Read our wrapper config to get the name
    const wrapperConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    const serverName = wrapperConfig.name.toLowerCase().replace(/\s+/g, '-');

    // Create MCP config for Claude Code
    const mcpConfig = {
      mcpServers: {
        [serverName]: {
          command: 'npx',
          args: ['-y', 'mcp-context-saver', 'serve', path.relative(process.cwd(), configPath)],
          env: {
            OPENAI_API_KEY: process.env.OPENAI_API_KEY || '${OPENAI_API_KEY}'
          }
        }
      }
    };

    await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));

    console.log(chalk.green('✅ Claude Code configuration created!'));
    console.log(chalk.dim(`Configuration written to: ${mcpConfigPath}`));
    console.log(chalk.yellow('\n⚠️  Reload your VS Code window for changes to take effect.'));
    console.log(chalk.dim('   (Cmd/Ctrl + Shift + P → "Developer: Reload Window")'));
  }

  private async configureVSCode(configPath: string): Promise<void> {
    console.log(chalk.cyan('\n⚙️  Configuring VS Code MCP Extension...\n'));

    const vscodeDir = path.join(process.cwd(), '.vscode');
    const vscodeConfigPath = path.join(vscodeDir, 'mcp.json');

    // Create .vscode directory
    await fs.mkdir(vscodeDir, { recursive: true });

    // Read our wrapper config to get the name
    const wrapperConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    const serverName = wrapperConfig.name.toLowerCase().replace(/\s+/g, '-');

    // Create VS Code MCP config
    const vscodeConfig = {
      servers: {
        [serverName]: {
          command: 'npx',
          args: ['mcp-context-saver', 'serve', path.relative(process.cwd(), configPath)],
          env: {
            OPENAI_API_KEY: '${env:OPENAI_API_KEY}'
          }
        }
      }
    };

    await fs.writeFile(vscodeConfigPath, JSON.stringify(vscodeConfig, null, 2));

    console.log(chalk.green('✅ VS Code MCP extension configured!'));
    console.log(chalk.dim(`Configuration written to: ${vscodeConfigPath}`));
  }

  private async showCustomConfig(configPath: string): Promise<void> {
    const absolutePath = path.resolve(configPath);
    
    console.log(chalk.cyan('\n📋 Custom Configuration\n'));
    console.log('Add this to your MCP client configuration:\n');
    
    console.log(chalk.white(JSON.stringify({
      "your-wrapper-name": {
        command: "npx",
        args: ["-y", "mcp-context-saver", "serve", absolutePath],
        env: {
          OPENAI_API_KEY: "your-api-key-here"
        }
      }
    }, null, 2)));

    console.log(chalk.cyan('\n📚 For TypeScript/JavaScript clients:\n'));
    console.log(chalk.white(`
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "mcp-context-saver", "serve", "${absolutePath}"],
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
  }
});
`));
  }

  private async showRegistryServers(): Promise<void> {
    this.spinner.start('Fetching MCP servers from npm registry...');

    try {
      const { stdout } = await exec('npm search mcp server --json');
      const packages = JSON.parse(stdout);
      
      const mcpPackages = packages
        .filter((pkg: any) => 
          pkg.name.includes('mcp') || 
          pkg.name.includes('modelcontextprotocol') ||
          pkg.description?.toLowerCase().includes('mcp')
        )
        .slice(0, 10);

      this.spinner.stop();

      if (mcpPackages.length === 0) {
        console.log(chalk.yellow('No MCP servers found in npm registry.'));
        return;
      }

      console.log(chalk.cyan('\n📦 Available MCP Servers:\n'));
      
      const { selectedPackage } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedPackage',
        message: 'Select a server to install and wrap:',
        choices: mcpPackages.map((pkg: any) => ({
          name: `${pkg.name} - ${pkg.description || 'No description'}`,
          value: pkg.name
        })).concat([{
          name: '← Back',
          value: null
        }])
      }]);

      if (!selectedPackage) {
        return;
      }

      await this.installAndWrap(selectedPackage);
    } catch (error) {
      this.spinner.fail('Failed to fetch packages');
      console.error(error);
    }
  }

  private async installAndWrap(packageName: string): Promise<void> {
    const { installGlobal } = await inquirer.prompt([{
      type: 'confirm',
      name: 'installGlobal',
      message: 'Install globally?',
      default: false
    }]);

    this.spinner.start(`Installing ${packageName}...`);

    try {
      const installCmd = installGlobal ? 
        `npm install -g ${packageName}` : 
        `npm install ${packageName}`;
      
      await exec(installCmd);
      this.spinner.succeed(`Installed ${packageName}`);

      // Try to find the installed server
      let serverPath = packageName;
      if (!installGlobal) {
        serverPath = path.join(process.cwd(), 'node_modules', packageName);
      }

      await this.analyzeAndWrap(serverPath, packageName);
    } catch (error) {
      this.spinner.fail('Installation failed');
      throw error;
    }
  }

  private async listConfigs(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.configDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(this.configDir, f));
    } catch {
      return [];
    }
  }

  private async showHelp(): Promise<void> {
    console.log(chalk.cyan('\n📚 MCP Context Saver Installer Help\n'));
    
    console.log(chalk.white('This installer helps you:'));
    console.log('  • Discover and analyze MCP servers');
    console.log('  • Create intelligent wrappers with LLM coordination');
    console.log('  • Configure wrappers for various AI agents');
    console.log('  • Validate your setup\n');

    console.log(chalk.white('Quick commands:'));
    console.log(chalk.green('  mcp-context-saver install'));
    console.log('    Interactive installation wizard\n');
    
    console.log(chalk.green('  mcp-context-saver install --server ./my-server.js'));
    console.log('    Wrap a specific server\n');
    
    console.log(chalk.green('  mcp-context-saver install --agent claude-desktop'));
    console.log('    Configure for a specific AI agent\n');

    console.log(chalk.white('For more information:'));
    console.log('  https://github.com/dennisonbertram/mcp-context-saver');
  }

  private async directSetup(options: InstallerOptions): Promise<void> {
    if (options.server) {
      await this.analyzeAndWrap(options.server, path.basename(options.server));
      
      if (options.agent) {
        const configs = await this.listConfigs();
        const latestConfig = configs[configs.length - 1];
        
        switch (options.agent) {
          case 'claude-desktop':
            await this.configureClaudeDesktop(latestConfig);
            break;
          case 'claude-code':
            await this.configureClaudeCode(latestConfig);
            break;
          case 'vscode':
            await this.configureVSCode(latestConfig);
            break;
          default:
            console.log(chalk.yellow(`Unknown agent: ${options.agent}`));
        }
      }
    }
  }
}

// CLI setup
const program = new Command();

program
  .name('mcp-context-saver-install')
  .description('Interactive installer for MCP Context Saver')
  .version('1.0.0')
  .option('-s, --server <path>', 'Path to MCP server to wrap')
  .option('-a, --agent <type>', 'Configure for specific agent (claude-desktop, claude-code, vscode)')
  .option('-c, --config <path>', 'Use existing configuration file')
  .option('--skip-analysis', 'Skip analysis step (requires existing config)')
  .option('--no-interactive', 'Disable interactive mode')
  .action(async (options) => {
    const installer = new MCPInstaller();
    await installer.run(options);
  });

// Handle standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export { MCPInstaller };