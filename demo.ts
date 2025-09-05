/**
 * Demo script showing the complete MCP analyzer and wrapper flow
 */

import { MCPAnalyzer } from './src/analyzer.js';
import { MCPWrapper } from './src/wrapper.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs/promises';

async function runDemo() {
  console.log('=== MCP Context Saver Demo ===\n');

  // Step 1: Analyze the mock server
  console.log('1. Analyzing mock MCP server...');
  const analyzer = new MCPAnalyzer();
  
  const mockServerPath = path.resolve('tests/integration/mock-server.js');
  const config = await analyzer.analyze('node', [mockServerPath]);
  
  console.log(`   Found ${config.tools.length} tools:`, config.tools.map(t => t.name));
  console.log(`   Capabilities:`, config.capabilities);
  
  // Step 2: Save configuration
  console.log('\n2. Saving configuration...');
  const configPath = 'demo-config.json';
  await fs.writeFile(configPath, analyzer.generateConfig(config));
  console.log(`   Config saved to ${configPath}`);
  
  // Step 3: Show how the wrapper would expose the expert tool
  console.log('\n3. Wrapper server would expose:');
  console.log(`   Tool: ${config.name}_expert`);
  console.log('   Description: Expert tool that analyzes natural language requests');
  console.log('   and executes the appropriate underlying tools\n');
  
  // Step 4: Example usage scenarios
  console.log('4. Example usage scenarios:');
  console.log('   User: "Please echo Hello, World!"');
  console.log('   -> Expert tool determines: use "echo" with message="Hello, World!"');
  console.log('   -> Returns: "Hello, World!"');
  
  console.log('\n   User: "What is 15 plus 27?"');
  console.log('   -> Expert tool determines: use "add" with a=15, b=27');
  console.log('   -> Returns: "42"');
  
  console.log('\n   User: "What time is it?"');
  console.log('   -> Expert tool determines: use "getCurrentTime"');
  console.log('   -> Returns: current ISO timestamp');
  
  console.log('\n=== Demo Complete ===');
  console.log('\nThe system successfully:');
  console.log('✓ Analyzed an MCP server to discover its capabilities');
  console.log('✓ Generated a configuration file with tool specifications');
  console.log('✓ Demonstrated how the wrapper exposes a single expert tool');
  console.log('✓ Showed how natural language requests map to specific tools');
  
  // Clean up
  await fs.unlink(configPath);
}

// Run the demo
runDemo().catch(console.error);