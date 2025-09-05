#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'simple-test-server',
  version: '1.0.0'
});

// Add a simple echo tool
server.registerTool('echo', {
  description: 'Echo back a message',
  inputSchema: {
    message: z.string().describe('Message to echo')
  }
}, async ({ message }) => ({
  content: [{ type: 'text', text: `Echo: ${message}` }]
}));

const transport = new StdioServerTransport();
await server.connect(transport);