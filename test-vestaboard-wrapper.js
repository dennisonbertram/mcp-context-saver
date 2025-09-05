#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

console.log('Testing Vestaboard wrapper server...');

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/src/cli.js', 'serve', 'configs/vestaboard-manager-1756987583259.json'],
  env: { ...process.env, OPENAI_API_KEY: process.env.OPENAI_API_KEY }
});

const client = new Client({
  name: 'vestaboard-test-client',
  version: '1.0.0'
});

try {
  await client.connect(transport);
  console.log('✓ Connected to Vestaboard wrapper server');

  // List tools
  const tools = await client.listTools();
  console.log('✓ Available tools:', tools.tools.map(t => t.name));

  // Test the expert tool with different requests
  console.log('\n--- Testing capability discovery ---');
  const capabilityResult = await client.callTool({
    name: 'vestaboard-manager',
    arguments: {
      query: 'What can you do with the Vestaboard?',
      mode: 'discover'
    }
  });
  console.log('✓ Capability discovery:', JSON.stringify(capabilityResult.content, null, 2));

  console.log('\n--- Testing message sending (would need API key for real execution) ---');
  const messageResult = await client.callTool({
    name: 'vestaboard-manager',
    arguments: {
      query: 'Can you send "HELLO WORLD" to the Vestaboard?',
      mode: 'execute'
    }
  });
  console.log('✓ Message sending test:', JSON.stringify(messageResult.content, null, 2));

  console.log('\n--- Testing board status inquiry ---');
  const statusResult = await client.callTool({
    name: 'vestaboard-manager',
    arguments: {
      query: 'What is the current status of the Vestaboard?',
      mode: 'execute'
    }
  });
  console.log('✓ Status inquiry:', JSON.stringify(statusResult.content, null, 2));
  
} catch (error) {
  console.error('✗ Error:', error.message);
} finally {
  process.exit(0);
}