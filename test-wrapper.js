#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

console.log('Testing wrapper server...');

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/src/cli.js', 'serve', 'configs/echo-expert-1756953260051.json'],
  env: { ...process.env, OPENAI_API_KEY: process.env.OPENAI_API_KEY }
});

const client = new Client({
  name: 'test-client',
  version: '1.0.0'
});

try {
  await client.connect(transport);
  console.log('✓ Connected to wrapper server');

  // List tools
  const tools = await client.listTools();
  console.log('✓ Available tools:', tools.tools.map(t => t.name));

  // Test the expert tool
  const result = await client.callTool({
    name: 'echo-expert',
    arguments: {
      query: 'Please echo "Hello from the wrapper!"',
      mode: 'execute'
    }
  });

  console.log('✓ Expert tool result:', JSON.stringify(result.content, null, 2));
  
} catch (error) {
  console.error('✗ Error:', error.message);
} finally {
  process.exit(0);
}