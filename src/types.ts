/**
 * Shared types for MCP Context Saver
 */

import { z } from 'zod';

/**
 * Server capability information
 */
export interface ServerCapabilities {
  tools: any[];
  resources: any[];
  prompts: any[];
}

/**
 * LLM analysis result structure
 */
export interface LLMAnalysis {
  expertName: string;
  expertDescription: string;
  systemPrompt: string;
  capabilities: {
    tools: string[];
    resources: string[];
    prompts: string[];
  };
}

/**
 * Configuration file structure
 */
export interface ServerConfig {
  name: string;
  description: string;
  serverPath: string;
  args: string[];
  systemPrompt: string;
  capabilities: ServerCapabilities;
  metadata: {
    analyzedAt: string;
    toolCount: number;
    resourceCount: number;
    promptCount: number;
  };
}

/**
 * Result of analyzing an MCP server
 */
export interface AnalysisResult {
  expertName: string;
  expertDescription: string;
  systemPrompt: string;
  capabilities: ServerCapabilities;
  configPath: string;
}

/**
 * Wrapper configuration schema using Zod
 */
export const WrapperConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  serverPath: z.string(),
  args: z.array(z.string()),
  systemPrompt: z.string(),
  capabilities: z.object({
    tools: z.array(z.any()),
    resources: z.array(z.any()),
    prompts: z.array(z.any())
  }),
  metadata: z.object({
    analyzedAt: z.string(),
    toolCount: z.number(),
    resourceCount: z.number(),
    promptCount: z.number()
  })
});

export type WrapperConfig = z.infer<typeof WrapperConfigSchema>;

/**
 * Expert tool input schema
 */
export const ExpertToolSchema = z.object({
  query: z.string().describe('Your request or question'),
  mode: z.enum(['discover', 'execute', 'explain']).optional().describe('Operation mode')
});

export type ExpertToolInput = z.infer<typeof ExpertToolSchema>;

/**
 * Tool definition structure
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}