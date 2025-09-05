/**
 * Integration test for the complete MCP analyzer and wrapper flow
 * Tests: Mock server -> Analyzer -> Wrapper -> Client usage
 */

import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { analyzeServer } from '../../src/analyzer.js';
import { startWrapperServer } from '../../src/wrapper.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';

// For compatibility with Jest
const testDir = path.resolve('tests/integration');

describe('Full MCP Flow Integration Test', () => {
  let mockServerProcess: ChildProcess | null = null;
  let wrapperServerProcess: ChildProcess | null = null;
  const configPath = path.join(testDir, 'test-config.json');

  // Helper to wait for server to be ready
  const waitForServer = (process: ChildProcess, name: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`${name} failed to start within timeout`));
      }, 10000);

      process.stderr?.on('data', (data) => {
        const message = data.toString();
        console.log(`[${name}] ${message}`);
        if (message.includes('started') || message.includes('ready')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      process.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      process.on('exit', (code) => {
        if (code !== null && code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`${name} exited with code ${code}`));
        }
      });
    });
  };

  afterEach(async () => {
    // Clean up processes
    if (mockServerProcess) {
      mockServerProcess.kill();
      mockServerProcess = null;
    }
    if (wrapperServerProcess) {
      wrapperServerProcess.kill();
      wrapperServerProcess = null;
    }

    // Clean up config file
    try {
      await fs.unlink(configPath);
    } catch {
      // File might not exist
    }
  });

  test('Complete flow: analyze mock server, generate config, use wrapper', async () => {
    console.log('Starting integration test...');

    // Skip if OPENAI_API_KEY is not set
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping integration test - OPENAI_API_KEY not set');
      return;
    }

    // Step 1: Build everything
    console.log('Step 1: Building project and mock server...');
    
    // Build main project first
    const mainBuildResult = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
    });
    
    await new Promise((resolve, reject) => {
      mainBuildResult.on('exit', (code) => {
        if (code === 0) resolve(undefined);
        else reject(new Error(`Main build failed with code ${code}`));
      });
    });
    
    // Then build mock server
    const buildResult = spawn('npx', ['tsc', path.join(testDir, 'mock-server.ts'), '--outDir', testDir, '--module', 'ES2022', '--target', 'ES2022', '--moduleResolution', 'node'], {
      stdio: 'inherit',
    });
    
    await new Promise((resolve, reject) => {
      buildResult.on('exit', (code) => {
        if (code === 0) resolve(undefined);
        else reject(new Error(`Mock server build failed with code ${code}`));
      });
    });

    // Step 2: Analyze the mock server
    console.log('Step 2: Analyzing mock server...');
    
    const mockServerPath = path.join(testDir, 'mock-server.js');
    const result = await analyzeServer('node', [mockServerPath]);
    
    // Verify the analysis found our tools
    expect(result.capabilities.tools).toHaveLength(3);
    expect(result.capabilities.tools.map((t: any) => t.name)).toContain('echo');
    expect(result.capabilities.tools.map((t: any) => t.name)).toContain('add');
    expect(result.capabilities.tools.map((t: any) => t.name)).toContain('getCurrentTime');

    console.log('Analysis complete. Found tools:', result.capabilities.tools.map((t: any) => t.name));

    // Step 3: Save the configuration to our test file
    console.log('Step 3: Saving configuration...');
    const config = {
      name: result.expertName,
      description: result.expertDescription,
      serverPath: 'node',
      args: [mockServerPath],
      systemPrompt: result.systemPrompt,
      capabilities: result.capabilities,
      metadata: {
        analyzedAt: new Date().toISOString(),
        toolCount: result.capabilities.tools.length,
        resourceCount: result.capabilities.resources.length,
        promptCount: result.capabilities.prompts.length
      }
    };
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // Step 4: Create and start wrapper server with the config
    console.log('Step 4: Starting wrapper server...');

    // Create a wrapper server file that can be spawned
    const wrapperServerCode = `
import { startWrapperServer } from '${path.resolve('dist/src/wrapper.js')}';

startWrapperServer('${configPath}').then(() => {
  console.error('Wrapper server ready');
}).catch(console.error);
`;

    const wrapperServerPath = path.join(testDir, 'wrapper-server-temp.js');
    await fs.writeFile(wrapperServerPath, wrapperServerCode);

    // Start the wrapper server
    wrapperServerProcess = spawn('node', [wrapperServerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    await waitForServer(wrapperServerProcess, 'Wrapper Server');

    // Step 5: Connect as a client and test the expert tool
    console.log('Step 5: Testing expert tool as client...');
    const client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    const transport = new StdioClientTransport({
      command: 'node',
      args: [wrapperServerPath],
    });

    await client.connect(transport);

    try {
      // List available tools
      const toolsResponse = await client.request(
        { method: 'tools/list', params: {} },
        z.object({ tools: z.array(z.any()) })
      );

      const tools = toolsResponse.tools;
      console.log('Available tools:', tools.map((t: any) => t.name));
      
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toContain('expert');

      // Test 1: Echo functionality
      console.log('Testing echo through expert tool...');
      const echoResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: tools[0].name,
            arguments: {
              query: 'Please echo "Hello, World!"',
            },
          },
        },
        z.object({ content: z.array(z.any()) })
      );

      const echoContent = JSON.parse(echoResponse.content[0].text);
      console.log('Echo response:', echoContent);
      expect(echoContent.results).toHaveLength(1);
      expect(echoContent.results[0].result[0].text).toBe('Hello, World!');

      // Test 2: Add functionality
      console.log('Testing add through expert tool...');
      const addResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: tools[0].name,
            arguments: {
              query: 'Please add 15 and 27',
            },
          },
        },
        z.object({ content: z.array(z.any()) })
      );

      const addContent = JSON.parse(addResponse.content[0].text);
      console.log('Add response:', addContent);
      expect(addContent.results).toHaveLength(1);
      expect(addContent.results[0].result[0].text).toBe('42');

      // Test 3: Discover mode
      console.log('Testing discover mode...');
      const discoverResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: tools[0].name,
            arguments: {
              query: 'What can you do?',
              mode: 'discover'
            },
          },
        },
        z.object({ content: z.array(z.any()) })
      );

      const discoverContent = JSON.parse(discoverResponse.content[0].text);
      console.log('Discover response:', discoverContent);
      expect(discoverContent.tools).toHaveLength(3);
      expect(discoverContent.tools.map((t: any) => t.name)).toContain('echo');

      console.log('All tests passed successfully!');
    } finally {
      await client.close();
    }

    // Clean up temporary wrapper file
    await fs.unlink(wrapperServerPath);
  }, 45000); // 45 second timeout for the full test
});