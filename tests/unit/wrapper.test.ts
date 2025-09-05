/**
 * Unit tests for the MCP wrapper server
 */

import { loadConfig, createExpertTool, connectToWrappedServer } from '../../src/wrapper.js';
import { WrapperConfig } from '../../src/types.js';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');
jest.mock('ai');
jest.mock('@ai-sdk/openai');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('MCP Wrapper', () => {
  const validConfig: WrapperConfig = {
    name: 'Test Expert',
    description: 'A test expert for unit testing',
    serverPath: '/path/to/server',
    args: ['--test'],
    systemPrompt: 'You are a test expert.',
    capabilities: {
      tools: [{ name: 'test-tool', description: 'A test tool' }],
      resources: [],
      prompts: []
    },
    metadata: {
      analyzedAt: '2023-01-01T00:00:00.000Z',
      toolCount: 1,
      resourceCount: 0,
      promptCount: 0
    }
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('Configuration Loading', () => {
    test('should load valid configuration', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(validConfig));

      const result = await loadConfig('/test/config.json');
      
      expect(result).toEqual(validConfig);
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/config.json', 'utf-8');
    });

    test('should handle file not found', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(loadConfig('/nonexistent/config.json')).rejects.toThrow(
        'Failed to load configuration: ENOENT: no such file or directory'
      );
    });

    test('should handle invalid JSON', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');

      await expect(loadConfig('/test/invalid.json')).rejects.toThrow(
        'Failed to load configuration:'
      );
    });

    test('should validate configuration schema', async () => {
      const invalidConfig = {
        ...validConfig,
        name: null // Invalid: name should be string
      };
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(loadConfig('/test/invalid.json')).rejects.toThrow();
    });

    test('should handle missing required fields', async () => {
      const incompleteConfig = {
        name: 'Test',
        // Missing required fields
      };
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(incompleteConfig));

      await expect(loadConfig('/test/incomplete.json')).rejects.toThrow();
    });
  });

  describe('Expert Tool Creation', () => {
    test('should create expert tool with correct structure', () => {
      const tool = createExpertTool(validConfig);

      expect(tool).toEqual({
        name: 'test-expert',
        description: 'A test expert for unit testing',
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
      });
    });

    test('should handle special characters in name', () => {
      const configWithSpecialChars: WrapperConfig = {
        ...validConfig,
        name: 'Test Expert with Spaces & Special!'
      };

      const tool = createExpertTool(configWithSpecialChars);

      expect(tool.name).toBe('test-expert-with-spaces-&-special!');
    });

    test('should create unique tool names from descriptions', () => {
      const configs = [
        { ...validConfig, name: 'File Manager' },
        { ...validConfig, name: 'Database Helper' },
        { ...validConfig, name: 'API Gateway' }
      ];

      const tools = configs.map(createExpertTool);
      const names = tools.map(t => t.name);

      expect(names).toEqual(['file-manager', 'database-helper', 'api-gateway']);
      expect(new Set(names).size).toBe(3); // All unique
    });
  });

  describe('Wrapped Server Connection', () => {
    test('should create transport with correct parameters', async () => {
      const mockTransport = {
        start: jest.fn().mockResolvedValue(undefined)
      };
      const mockClient = {
        connect: jest.fn().mockResolvedValue(undefined)
      };

      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');

      (StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>).mockImplementation(() => mockTransport as any);
      (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient as any);

      await connectToWrappedServer(validConfig);

      expect(StdioClientTransport).toHaveBeenCalledWith({
        command: '/path/to/server',
        args: ['--test']
      });
      expect(mockTransport.start).toHaveBeenCalled();
      expect(mockClient.connect).toHaveBeenCalledWith(mockTransport);
    });

    test('should handle connection failures', async () => {
      const mockTransport = {
        start: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };
      const mockClient = {
        connect: jest.fn()
      };

      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');

      (StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>).mockImplementation(() => mockTransport as any);
      (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient as any);

      await expect(connectToWrappedServer(validConfig)).rejects.toThrow(
        'Failed to connect to wrapped server: Connection failed'
      );
    });
  });

  describe('Input Validation', () => {
    test('should accept valid config with all fields', () => {
      expect(() => createExpertTool(validConfig)).not.toThrow();
    });

    test('should handle empty arrays in capabilities', () => {
      const configWithEmptyCapabilities: WrapperConfig = {
        ...validConfig,
        capabilities: {
          tools: [],
          resources: [],
          prompts: []
        }
      };

      expect(() => createExpertTool(configWithEmptyCapabilities)).not.toThrow();
    });

    test('should handle configs with no arguments', () => {
      const configNoArgs: WrapperConfig = {
        ...validConfig,
        args: []
      };

      const tool = createExpertTool(configNoArgs);
      expect(tool).toBeDefined();
      expect(tool.name).toBe('test-expert');
    });
  });
});