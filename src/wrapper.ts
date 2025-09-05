/**
 * Runtime MCP wrapper server implementation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import * as fs from 'fs/promises';
import {
  WrapperConfig,
  WrapperConfigSchema,
  ExpertToolSchema,
  ToolDefinition
} from './types.js';

/**
 * Loads configuration from file
 */
export async function loadConfig(configPath: string): Promise<WrapperConfig> {
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    return WrapperConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Creates the expert tool definition from configuration
 */
export function createExpertTool(config: WrapperConfig): ToolDefinition {
  const toolName = config.name.toLowerCase().replace(/\s+/g, '-');
  
  return {
    name: toolName,
    description: config.description,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Your request or question'
        },
        mode: {
          type: 'string',
          enum: ['discover', 'execute', 'explain'],
          description: 'Operation mode'
        }
      },
      required: ['query']
    }
  };
}

/**
 * Connects to the wrapped MCP server
 */
export async function connectToWrappedServer(
  config: WrapperConfig
): Promise<{ client: Client; transport: StdioClientTransport }> {
  const transport = new StdioClientTransport({
    command: config.serverPath,
    args: config.args
  });

  const client = new Client({
    name: 'mcp-wrapper-client',
    version: '0.0.1'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    return { client, transport };
  } catch (error) {
    throw new Error(`Failed to connect to wrapped server: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Handles expert tool execution
 */
async function handleExpertQuery(
  query: string,
  mode: string | undefined,
  config: WrapperConfig,
  wrappedClient: Client
): Promise<any> {
  const effectiveMode = mode || 'execute';

  // Handle discover mode
  if (effectiveMode === 'discover') {
    const [tools, resources, prompts] = await Promise.all([
      wrappedClient.listTools(),
      wrappedClient.listResources(),
      wrappedClient.listPrompts()
    ]);

    return {
      summary: `${config.name} provides ${tools.tools?.length || 0} tools, ${resources.resources?.length || 0} resources, and ${prompts.prompts?.length || 0} prompts`,
      tools: tools.tools || [],
      resources: resources.resources || [],
      prompts: prompts.prompts || []
    };
  }

  // Handle explain mode
  if (effectiveMode === 'explain') {
    const tools = await wrappedClient.listTools();
    const toolNames = tools.tools?.map(t => t.name).join(', ') || 'none';
    
    return {
      description: config.description,
      systemPrompt: config.systemPrompt,
      availableTools: toolNames,
      usage: `Ask me to perform tasks and I'll use the appropriate tools from the wrapped server.`
    };
  }

  // Handle execute mode - use LLM to coordinate
  const tools = await wrappedClient.listTools();
  
  const coordinationPrompt = `
${config.systemPrompt}

Available tools:
${JSON.stringify(tools.tools || [], null, 2)}

User query: ${query}

Based on the user's query and available tools, determine which tool(s) to use and with what arguments.
Respond with a JSON object in this format:
{
  "toolCalls": [
    {
      "name": "tool_name",
      "arguments": { ... }
    }
  ],
  "explanation": "Brief explanation of what you're doing"
}

Respond ONLY with valid JSON.`;

  try {
    const llmResponse = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: coordinationPrompt,
      temperature: 0.3
    });

    const plan = JSON.parse(llmResponse.text);
    const results = [];

    // Execute planned tool calls
    for (const toolCall of plan.toolCalls || []) {
      try {
        const result = await wrappedClient.callTool({
          name: toolCall.name,
          arguments: toolCall.arguments
        });
        results.push({
          tool: toolCall.name,
          result: result.content
        });
      } catch (error) {
        results.push({
          tool: toolCall.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      explanation: plan.explanation,
      results
    };
  } catch (error) {
    throw new Error(`Failed to coordinate with wrapped server: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validates environment configuration
 */
function validateEnvironment(): void {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
}

/**
 * Starts the wrapper MCP server
 */
export async function startWrapperServer(configPath: string): Promise<void> {
  // Validate environment
  validateEnvironment();

  // Load configuration
  const config = await loadConfig(configPath);

  // Connect to wrapped server
  const { client: wrappedClient } = await connectToWrappedServer(config);

  // Create expert tool
  const expertTool = createExpertTool(config);

  // Create MCP server
  const server = new Server({
    name: 'mcp-context-saver',
    version: '0.0.1'
  }, {
    capabilities: {
      tools: {}
    }
  });

  // Register handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [expertTool]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== expertTool.name) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const args = ExpertToolSchema.parse(request.params.arguments);
    const result = await handleExpertQuery(
      args.query,
      args.mode,
      config,
      wrappedClient
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  });

  // Start server transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle shutdown
  process.on('SIGINT', async () => {
    await wrappedClient.close();
    await server.close();
    process.exit(0);
  });
}