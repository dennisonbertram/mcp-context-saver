#!/usr/bin/env node

/**
 * Unified CLI for MCP Context Saver
 * Provides commands for analyzing MCP servers and running wrapper servers
 */

import { Command } from 'commander';
import { analyzeServer } from './analyzer.js';
import { startWrapperServer } from './wrapper.js';
import * as path from 'path';
import * as process from 'process';

const program = new Command();

program
  .name('mcp-context-saver')
  .description('MCP Context Saver - Analyze MCP servers and create LLM-powered wrappers')
  .version('0.0.1');

// Install command - interactive installer
program
  .command('install')
  .description('Interactive installer to discover, wrap, and configure MCP servers')
  .option('-s, --server <path>', 'Path to MCP server to wrap')
  .option('-a, --agent <type>', 'Configure for specific agent (claude-desktop, claude-code, vscode)')
  .action(async (options) => {
    try {
      // Dynamic import to avoid circular dependencies
      const { MCPInstaller } = await import('./installer.js');
      const installer = new MCPInstaller();
      await installer.run(options);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze an MCP server and generate configuration')
  .argument('<server-path>', 'Path to the MCP server executable')
  .argument('[args...]', 'Additional arguments for the server')
  .action(async (serverPath: string, args: string[] = []) => {
    try {
      // Validate inputs
      if (!serverPath || serverPath.trim() === '') {
        console.error('Error: Server path is required');
        process.exit(1);
      }

      console.log('Analyzing MCP server...');
      console.log(`Server: ${serverPath}`);
      if (args.length > 0) {
        console.log(`Args: ${args.join(' ')}`);
      }
      console.log('');

      // Analyze the server
      const result = await analyzeServer(serverPath, args);

      // Display results
      console.log('✓ Analysis complete!');
      console.log('');
      console.log(`Expert: ${result.expertName}`);
      console.log(`Description: ${result.expertDescription}`);
      console.log('');
      console.log('Capabilities discovered:');
      console.log(`  - ${result.capabilities.tools.length} tools`);
      console.log(`  - ${result.capabilities.resources.length} resources`);
      console.log(`  - ${result.capabilities.prompts.length} prompts`);
      console.log('');
      console.log(`Configuration saved to: ${result.configPath}`);
      console.log('');
      console.log('System Prompt:');
      console.log(result.systemPrompt);
      console.log('');
      console.log('To run the wrapper server with this configuration:');
      console.log(`  mcp-context-saver serve ${result.configPath}`);

    } catch (error) {
      console.error('Error analyzing server:');
      
      if (error instanceof Error) {
        console.error(error.message);
        
        // Provide helpful guidance for common errors
        if (error.message.includes('OPENAI_API_KEY')) {
          console.error('');
          console.error('Please set your OpenAI API key:');
          console.error('  export OPENAI_API_KEY=your-api-key');
        } else if (error.message.includes('Failed to connect')) {
          console.error('');
          console.error('Make sure the server path is correct and the server is executable.');
          console.error('You may need to build the server or install its dependencies first.');
        }
      } else {
        console.error(String(error));
      }
      
      process.exit(1);
    }
  });

// Serve command
program
  .command('serve')
  .description('Start the wrapper server with a configuration file')
  .argument('<config>', 'Path to the configuration file')
  .action(async (configPath: string) => {
    try {
      console.log(`Starting wrapper server with config: ${configPath}`);
      console.log('');
      console.log('The server is now running and ready to receive MCP requests.');
      console.log('Press Ctrl+C to stop the server.');
      console.log('');
      
      // Resolve to absolute path
      const absolutePath = path.isAbsolute(configPath) 
        ? configPath 
        : path.resolve(process.cwd(), configPath);
      
      await startWrapperServer(absolutePath);
    } catch (error) {
      console.error(`Failed to start wrapper server:`);
      
      if (error instanceof Error) {
        console.error(error.message);
        
        // Provide helpful guidance for common errors
        if (error.message.includes('OPENAI_API_KEY')) {
          console.error('');
          console.error('Please set your OpenAI API key:');
          console.error('  export OPENAI_API_KEY=your-api-key');
        } else if (error.message.includes('Failed to load configuration')) {
          console.error('');
          console.error('Make sure the configuration file exists and is valid JSON.');
          console.error('You can generate a configuration using:');
          console.error('  mcp-context-saver analyze <server-path>');
        } else if (error.message.includes('Failed to connect to wrapped server')) {
          console.error('');
          console.error('The wrapped server could not be started.');
          console.error('Check that the server path in the configuration is correct.');
        }
      } else {
        console.error(String(error));
      }
      
      process.exit(1);
    }
  });

// Help examples
program.addHelpText('after', `
Examples:
  # Analyze a local MCP server
  mcp-context-saver analyze ./my-mcp-server.js

  # Analyze with arguments
  mcp-context-saver analyze /usr/local/bin/mcp-server --config server.json

  # Serve using a configuration
  mcp-context-saver serve ./configs/my-server-config.json

Environment Variables:
  OPENAI_API_KEY    Required for both analyze and serve commands
`);

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}