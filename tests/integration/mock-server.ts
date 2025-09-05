/**
 * Mock MCP server for integration testing
 * Provides simple tools to test the analyzer and wrapper flow
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Create server instance
const server = new Server(
  {
    name: 'mock-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool: echo - Returns the input string
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'echo',
        description: 'Returns the input string unchanged',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to echo back',
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'add',
        description: 'Adds two numbers together',
        inputSchema: {
          type: 'object',
          properties: {
            a: {
              type: 'number',
              description: 'First number',
            },
            b: {
              type: 'number',
              description: 'Second number',
            },
          },
          required: ['a', 'b'],
        },
      },
      {
        name: 'getCurrentTime',
        description: 'Returns the current time in ISO format',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'echo':
      if (!args || typeof args !== 'object' || !('message' in args)) {
        throw new Error('Missing required argument: message');
      }
      return {
        content: [
          {
            type: 'text',
            text: String(args.message),
          },
        ],
      };

    case 'add':
      if (!args || typeof args !== 'object' || !('a' in args) || !('b' in args)) {
        throw new Error('Missing required arguments: a and b');
      }
      const a = Number(args.a);
      const b = Number(args.b);
      if (isNaN(a) || isNaN(b)) {
        throw new Error('Arguments must be numbers');
      }
      return {
        content: [
          {
            type: 'text',
            text: String(a + b),
          },
        ],
      };

    case 'getCurrentTime':
      return {
        content: [
          {
            type: 'text',
            text: new Date().toISOString(),
          },
        ],
      };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr so it doesn't interfere with stdio protocol
  console.error('Mock MCP server started');
}

main().catch((error) => {
  console.error('Fatal error in mock server:', error);
  process.exit(1);
});