/**
 * Unit tests for the MCP server analyzer
 */

import { analyzeServer } from '../../src/analyzer.js';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');
jest.mock('ai');
jest.mock('@ai-sdk/openai');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('MCP Analyzer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Environment Validation', () => {
    test('should throw error when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      
      await expect(analyzeServer('/path/to/server')).rejects.toThrow(
        'OPENAI_API_KEY environment variable is required'
      );
    });

    test('should proceed when OPENAI_API_KEY is set', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      // Mock the client to throw connection error so we can test env validation passes
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      
      (Client as jest.MockedClass<typeof Client>).mockImplementation(() => {
        throw new Error('Connection failed - expected for this test');
      });
      
      await expect(analyzeServer('/path/to/server')).rejects.toThrow(
        'Connection failed - expected for this test'
      );
    });
  });

  describe('Server Path Validation', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
    });

    test('should handle empty server path', async () => {
      await expect(analyzeServer('')).rejects.toThrow();
    });

    test('should handle non-existent server path', async () => {
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      
      (StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>).mockImplementation(() => ({
        start: jest.fn().mockRejectedValue(new Error('Server not found'))
      }) as any);
      
      await expect(analyzeServer('/non/existent/path')).rejects.toThrow(
        'Failed to connect to MCP server: Server not found'
      );
    });
  });

  describe('Configuration Generation', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
    });

    test('should create configs directory', async () => {
      // Mock successful analysis flow
      const mockClient = {
        connect: jest.fn(),
        listTools: jest.fn().mockResolvedValue({ tools: [] }),
        listResources: jest.fn().mockResolvedValue({ resources: [] }),
        listPrompts: jest.fn().mockResolvedValue({ prompts: [] }),
        close: jest.fn()
      };

      const mockTransport = {
        start: jest.fn().mockResolvedValue(undefined)
      };

      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      const { generateText } = await import('ai');

      (StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>).mockImplementation(() => mockTransport as any);
      (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient as any);
      (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue({
        text: JSON.stringify({
          expertName: 'Test Expert',
          expertDescription: 'A test expert',
          systemPrompt: 'You are a test expert.',
          capabilities: {
            tools: [],
            resources: [],
            prompts: []
          }
        })
      } as any);

      await analyzeServer('/test/server');

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('configs'),
        { recursive: true }
      );
    });

    test('should save configuration file with timestamp', async () => {
      // Mock successful analysis flow
      const mockClient = {
        connect: jest.fn(),
        listTools: jest.fn().mockResolvedValue({ tools: [{ name: 'test-tool' }] }),
        listResources: jest.fn().mockResolvedValue({ resources: [] }),
        listPrompts: jest.fn().mockResolvedValue({ prompts: [] }),
        close: jest.fn()
      };

      const mockTransport = {
        start: jest.fn().mockResolvedValue(undefined)
      };

      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      const { generateText } = await import('ai');

      (StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>).mockImplementation(() => mockTransport as any);
      (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient as any);
      (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue({
        text: JSON.stringify({
          expertName: 'Test Expert',
          expertDescription: 'A test expert',
          systemPrompt: 'You are a test expert.',
          capabilities: {
            tools: ['test-tool'],
            resources: [],
            prompts: []
          }
        })
      } as any);

      const result = await analyzeServer('/test/server');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-expert-'),
        expect.stringContaining('"name": "Test Expert"'),
        'utf-8'
      );

      expect(result.configPath).toContain('test-expert-');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
    });

    test('should handle LLM analysis failure', async () => {
      const mockClient = {
        connect: jest.fn(),
        listTools: jest.fn().mockResolvedValue({ tools: [] }),
        listResources: jest.fn().mockResolvedValue({ resources: [] }),
        listPrompts: jest.fn().mockResolvedValue({ prompts: [] }),
        close: jest.fn()
      };

      const mockTransport = {
        start: jest.fn().mockResolvedValue(undefined)
      };

      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      const { generateText } = await import('ai');

      (StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>).mockImplementation(() => mockTransport as any);
      (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient as any);
      (generateText as jest.MockedFunction<typeof generateText>).mockRejectedValue(new Error('LLM API error'));

      await expect(analyzeServer('/test/server')).rejects.toThrow(
        'Failed to analyze server capabilities: LLM API error'
      );

      expect(mockClient.close).toHaveBeenCalled();
    });

    test('should handle file system errors', async () => {
      const mockClient = {
        connect: jest.fn(),
        listTools: jest.fn().mockResolvedValue({ tools: [] }),
        listResources: jest.fn().mockResolvedValue({ resources: [] }),
        listPrompts: jest.fn().mockResolvedValue({ prompts: [] }),
        close: jest.fn()
      };

      const mockTransport = {
        start: jest.fn().mockResolvedValue(undefined)
      };

      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      const { generateText } = await import('ai');

      (StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>).mockImplementation(() => mockTransport as any);
      (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient as any);
      (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue({
        text: JSON.stringify({
          expertName: 'Test Expert',
          expertDescription: 'A test expert',
          systemPrompt: 'You are a test expert.',
          capabilities: {
            tools: [],
            resources: [],
            prompts: []
          }
        })
      } as any);

      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      await expect(analyzeServer('/test/server')).rejects.toThrow('Permission denied');
      expect(mockClient.close).toHaveBeenCalled();
    });
  });
});