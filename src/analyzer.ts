/**
 * MCP Server Analyzer
 * Connects to MCP servers, discovers capabilities, and generates expert configurations
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ServerCapabilities,
  LLMAnalysis,
  ServerConfig,
  AnalysisResult
} from './types.js';

/**
 * Validates environment configuration
 */
function validateEnvironment(): void {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
}

/**
 * Establishes connection to MCP server
 */
async function connectToServer(
  serverPath: string,
  args: string[]
): Promise<{ client: Client; transport: StdioClientTransport }> {
  const transport = new StdioClientTransport({
    command: serverPath,
    args: args
  });

  const client = new Client({
    name: 'mcp-context-saver-analyzer',
    version: '0.0.1'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
  } catch (error) {
    throw new Error(`Failed to connect to MCP server: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { client, transport };
}

/**
 * Discovers server capabilities
 */
async function discoverCapabilities(client: Client): Promise<ServerCapabilities> {
  try {
    // Try tools first
    console.log('Discovering tools...');
    const toolsResponse = await client.listTools();
    console.log(`Found ${toolsResponse.tools?.length || 0} tools`);

    // Try resources (might not be supported)
    let resourcesResponse;
    try {
      console.log('Discovering resources...');
      resourcesResponse = await client.listResources();
      console.log(`Found ${resourcesResponse.resources?.length || 0} resources`);
    } catch (error) {
      console.log('Server does not support resources');
      resourcesResponse = { resources: [] };
    }

    // Try prompts (might not be supported)  
    let promptsResponse;
    try {
      console.log('Discovering prompts...');
      promptsResponse = await client.listPrompts();
      console.log(`Found ${promptsResponse.prompts?.length || 0} prompts`);
    } catch (error) {
      console.log('Server does not support prompts');
      promptsResponse = { prompts: [] };
    }

    return {
      tools: toolsResponse.tools || [],
      resources: resourcesResponse.resources || [],
      prompts: promptsResponse.prompts || []
    };
  } catch (error) {
    console.log('Error in discoverCapabilities:', error);
    throw error;
  }
}

/**
 * Analyzes capabilities using LLM
 */
async function analyzeWithLLM(capabilities: ServerCapabilities): Promise<LLMAnalysis> {
  const analysisPrompt = `
You are analyzing an MCP (Model Context Protocol) server's capabilities to generate an expert tool configuration.

The server provides the following capabilities:

TOOLS (${capabilities.tools.length}):
${JSON.stringify(capabilities.tools, null, 2)}

RESOURCES (${capabilities.resources.length}):
${JSON.stringify(capabilities.resources, null, 2)}

PROMPTS (${capabilities.prompts.length}):
${JSON.stringify(capabilities.prompts, null, 2)}

Based on these capabilities, generate a JSON configuration with the following structure:
{
  "expertName": "A concise, descriptive name for this expert (e.g., 'File System Expert', 'Database Manager')",
  "expertDescription": "A clear description of what this MCP server does and its primary capabilities",
  "systemPrompt": "A system prompt for an LLM to understand how to coordinate with this MCP server. Include key capabilities and usage guidance.",
  "capabilities": {
    "tools": ["list", "of", "tool", "names"],
    "resources": ["list", "of", "resource", "uris"],
    "prompts": ["list", "of", "prompt", "names"]
  }
}

Generate ONLY valid JSON without any markdown formatting or additional text.`;

  try {
    const response = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: analysisPrompt,
      temperature: 0.3
    });

    return JSON.parse(response.text) as LLMAnalysis;
  } catch (error) {
    throw new Error(`Failed to analyze server capabilities: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Saves configuration to file
 */
async function saveConfiguration(config: ServerConfig): Promise<string> {
  const configDir = path.join(process.cwd(), 'configs');
  await fs.mkdir(configDir, { recursive: true });

  const configFileName = `${config.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
  const configPath = path.join(configDir, configFileName);
  
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  return configPath;
}

/**
 * Analyzes an MCP server and generates a configuration file
 * @param serverPath - Path to the MCP server executable
 * @param args - Arguments to pass to the server
 * @returns Analysis result with generated configuration
 */
export async function analyzeServer(
  serverPath: string,
  args: string[] = []
): Promise<AnalysisResult> {
  validateEnvironment();

  let client: Client | null = null;

  try {
    // Connect to server
    const connection = await connectToServer(serverPath, args);
    client = connection.client;

    // Discover capabilities
    const capabilities = await discoverCapabilities(client);

    // Analyze capabilities with LLM
    const analysis = await analyzeWithLLM(capabilities);

    // Save configuration
    const configPath = await saveConfiguration({
      name: analysis.expertName,
      description: analysis.expertDescription,
      serverPath,
      args,
      systemPrompt: analysis.systemPrompt,
      capabilities,
      metadata: {
        analyzedAt: new Date().toISOString(),
        toolCount: capabilities.tools.length,
        resourceCount: capabilities.resources.length,
        promptCount: capabilities.prompts.length
      }
    });

    return {
      expertName: analysis.expertName,
      expertDescription: analysis.expertDescription,
      systemPrompt: analysis.systemPrompt,
      capabilities,
      configPath
    };

  } finally {
    // Clean up connections
    if (client) {
      await client.close();
    }
  }
}