#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

console.log('Testing Google Calendar wrapper server...');

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/src/cli.js', 'serve', 'configs/calendar-management-expert-1757002638204.json'],
  env: { ...process.env, OPENAI_API_KEY: process.env.OPENAI_API_KEY }
});

const client = new Client({
  name: 'calendar-test-client',
  version: '1.0.0'
});

try {
  await client.connect(transport);
  console.log('✓ Connected to Calendar wrapper server');

  // List tools
  const tools = await client.listTools();
  console.log('✓ Available expert tool:', tools.tools[0].name);
  console.log('  Description:', tools.tools[0].description);

  // Test discovery mode
  console.log('\n--- Testing capability discovery ---');
  const discoveryResult = await client.callTool({
    name: 'calendar-management-expert',
    arguments: {
      query: 'What calendar management capabilities do you have?',
      mode: 'discover'
    }
  });
  
  console.log('✓ Discovery response:');
  discoveryResult.content.forEach(item => {
    if (item.type === 'text') {
      const text = item.text;
      // Print first 500 chars
      console.log('  ', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
    }
  });

  // Test a simple query
  console.log('\n--- Testing list calendars request ---');
  const listResult = await client.callTool({
    name: 'calendar-management-expert',
    arguments: {
      query: 'Can you list my calendars?',
      mode: 'execute'
    }
  });
  
  console.log('✓ List calendars response:');
  listResult.content.forEach(item => {
    if (item.type === 'text') {
      const text = item.text;
      console.log('  ', text.substring(0, 300) + (text.length > 300 ? '...' : ''));
    }
  });
  
} catch (error) {
  console.error('✗ Error:', error.message);
} finally {
  process.exit(0);
}