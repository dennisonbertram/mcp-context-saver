#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

console.log('Testing Vestaboard wrapper with discovery mode...');

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
  console.log('✓ Available expert tool:', tools.tools[0].name);
  console.log('✓ Tool description:', tools.tools[0].description);

  // Test just the discovery mode which shouldn't call the actual Vestaboard API
  const result = await client.callTool({
    name: 'vestaboard-manager',
    arguments: {
      query: 'What are your capabilities?',
      mode: 'discover'
    }
  });
  
  console.log('✓ Discovery result:');
  result.content.forEach((item, i) => {
    if (item.type === 'text') {
      console.log(`   ${item.text.substring(0, 200)}${item.text.length > 200 ? '...' : ''}`);
    }
  });
  
} catch (error) {
  console.error('✗ Error:', error.message);
} finally {
  process.exit(0);
}