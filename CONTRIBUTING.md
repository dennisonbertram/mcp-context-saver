# Contributing to MCP Context Saver

Thank you for your interest in contributing to MCP Context Saver! This document provides guidelines and information to help you contribute effectively.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Code Style and Standards](#code-style-and-standards)
- [Adding New Features](#adding-new-features)
- [Debugging and Troubleshooting](#debugging-and-troubleshooting)
- [Release Process](#release-process)

## Development Setup

### Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Comes with Node.js
- **OpenAI API Key**: Required for testing LLM functionality
- **Git**: For version control

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/mcp-context-saver.git
   cd mcp-context-saver
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   # Create .env file for development (never commit this)
   echo "OPENAI_API_KEY=your-api-key-here" > .env
   
   # Or export directly
   export OPENAI_API_KEY=your-api-key-here
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

5. **Run tests to verify setup:**
   ```bash
   npm test
   ```

### Development Environment

**Recommended VS Code Extensions:**
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Jest Test Explorer
- MCP Protocol Support (if available)

**Environment Setup:**
```bash
# Development with auto-rebuild
npm run dev

# Watch mode for testing
npm run test -- --watch

# Clean build artifacts
npm run clean
```

## Project Structure

### Source Code Organization

```
src/
├── analyzer.ts          # MCP server analysis and configuration generation
├── wrapper.ts           # Runtime wrapper server implementation  
├── cli.ts              # Command-line interface
├── types.ts            # TypeScript type definitions and Zod schemas
└── index.ts            # Main entry point (if needed)
```

### Test Structure

```
tests/
├── unit/               # Unit tests for individual components
│   ├── analyzer.test.ts    # Tests for analyzer functionality
│   └── wrapper.test.ts     # Tests for wrapper functionality
├── integration/        # Integration and end-to-end tests
│   ├── full-flow.test.ts   # Complete workflow testing
│   ├── mock-server.ts      # TypeScript mock MCP server
│   └── mock-server.js      # Simple JavaScript mock server
└── fixtures/           # Test data and configuration files
```

### Configuration and Build

```
├── package.json        # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
├── jest.config.js     # Test configuration
├── .gitignore         # Git ignore rules
└── configs/           # Generated configurations (gitignored)
```

## Development Workflow

### Feature Development Process

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Implement your changes:**
   - Write code following the established patterns
   - Add appropriate types and validation
   - Include error handling
   - Update documentation as needed

3. **Write tests:**
   - Add unit tests for new functionality
   - Add integration tests for end-to-end features
   - Ensure all tests pass

4. **Build and verify:**
   ```bash
   npm run build
   npm test
   npm run dev -- --help  # Test CLI functionality
   ```

5. **Commit and push:**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

6. **Create a pull request:**
   - Describe your changes clearly
   - Include testing instructions
   - Reference any related issues

### Commit Message Format

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(analyzer): add support for custom LLM providers
fix(wrapper): handle connection errors gracefully
docs: update API documentation
test: add integration tests for CLI commands
```

## Testing Guidelines

### Test Categories

#### Unit Tests (`tests/unit/`)

Test individual components in isolation:

```typescript
// Example unit test structure
describe('analyzeServer', () => {
  it('should discover server capabilities', async () => {
    // Mock dependencies
    const mockClient = {
      listTools: jest.fn().mockResolvedValue({ tools: [...] }),
      listResources: jest.fn().mockResolvedValue({ resources: [...] })
    };
    
    // Test the function
    const result = await analyzeServer('/path/to/server');
    
    // Assert expectations
    expect(result.capabilities.tools).toHaveLength(expectedCount);
  });
});
```

#### Integration Tests (`tests/integration/`)

Test complete workflows:

```typescript
// Example integration test
describe('Full MCP Flow', () => {
  it('should analyze server and create working wrapper', async () => {
    // 1. Start mock MCP server
    // 2. Run analysis
    // 3. Start wrapper server
    // 4. Test expert tool functionality
    // 5. Verify results
  });
});
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage

# Specific test file
npm test analyzer.test.ts

# Debug mode
npm test -- --verbose
```

### Writing Good Tests

**Test Structure:**
```typescript
describe('Component/Function Name', () => {
  beforeEach(() => {
    // Setup code
  });

  afterEach(() => {
    // Cleanup code
  });

  it('should handle normal case', async () => {
    // Arrange
    const input = createTestInput();
    
    // Act
    const result = await functionUnderTest(input);
    
    // Assert
    expect(result).toEqual(expectedOutput);
  });

  it('should handle error case', async () => {
    // Test error conditions
    await expect(functionUnderTest(invalidInput))
      .rejects.toThrow('Expected error message');
  });
});
```

**Mock Guidelines:**
- Mock external dependencies (OpenAI API, file system, child processes)
- Use dependency injection where possible
- Create reusable mock factories
- Verify mock interactions when relevant

**Test Data:**
- Store test fixtures in `tests/fixtures/`
- Use realistic but minimal test data
- Include edge cases and error conditions

### Test Environment Setup

**Environment Variables for Testing:**
```bash
# Required for LLM integration tests
OPENAI_API_KEY=your-test-api-key

# Optional: Skip LLM tests if no API key
SKIP_LLM_TESTS=true
```

## Code Style and Standards

### TypeScript Guidelines

**Type Safety:**
- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use Zod for runtime validation
- Document complex types with TSDoc comments

**Example:**
```typescript
/**
 * Configuration for MCP server analysis
 */
interface AnalyzerConfig {
  /** Path to the MCP server executable */
  serverPath: string;
  /** Arguments to pass to the server */
  args: string[];
  /** Timeout for server operations in milliseconds */
  timeout?: number;
}

// Use Zod for runtime validation
const AnalyzerConfigSchema = z.object({
  serverPath: z.string().min(1),
  args: z.array(z.string()),
  timeout: z.number().positive().optional()
});
```

### Code Organization

**File Structure:**
- One main export per file
- Group related types together
- Use barrel exports (`index.ts`) for clean imports
- Keep files under 300 lines

**Error Handling:**
```typescript
// Good: Specific error types with context
class ServerConnectionError extends Error {
  constructor(serverPath: string, cause: Error) {
    super(`Failed to connect to MCP server at ${serverPath}: ${cause.message}`);
    this.name = 'ServerConnectionError';
    this.cause = cause;
  }
}

// Good: Graceful error handling with cleanup
async function connectWithCleanup() {
  let client: Client | null = null;
  try {
    client = await createClient();
    return await performOperation(client);
  } catch (error) {
    throw new ServerConnectionError(serverPath, error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}
```

### Documentation Standards

**Code Comments:**
```typescript
/**
 * Analyzes an MCP server and generates expert configuration
 * 
 * @param serverPath - Absolute path to the MCP server executable
 * @param args - Command line arguments for the server
 * @returns Promise resolving to analysis results with config path
 * 
 * @throws {ServerConnectionError} When server cannot be reached
 * @throws {AnalysisError} When LLM analysis fails
 * 
 * @example
 * ```typescript
 * const result = await analyzeServer('./my-server.js', ['--verbose']);
 * console.log(`Generated config: ${result.configPath}`);
 * ```
 */
export async function analyzeServer(
  serverPath: string, 
  args: string[] = []
): Promise<AnalysisResult> {
  // Implementation
}
```

**README Updates:**
- Update relevant sections when adding features
- Include new CLI options and examples
- Update architecture diagrams if needed

## Adding New Features

### Feature Development Checklist

**Planning:**
- [ ] Create or update GitHub issue describing the feature
- [ ] Design the API/interface
- [ ] Consider backward compatibility
- [ ] Plan testing strategy

**Implementation:**
- [ ] Add TypeScript types and validation schemas
- [ ] Implement core functionality
- [ ] Add comprehensive error handling
- [ ] Update CLI interface if needed
- [ ] Add configuration options if required

**Testing:**
- [ ] Write unit tests for new functions
- [ ] Add integration tests for end-to-end features
- [ ] Test error conditions
- [ ] Verify CLI functionality
- [ ] Test with real MCP servers

**Documentation:**
- [ ] Update README.md with new features
- [ ] Update ARCHITECTURE.md if design changes
- [ ] Add JSDoc comments for public APIs
- [ ] Update CLI help text

**Code Review:**
- [ ] Self-review code for style and best practices
- [ ] Verify all tests pass
- [ ] Check TypeScript compilation
- [ ] Run linting and formatting

### Common Feature Patterns

**Adding a New CLI Command:**

1. Update `src/cli.ts`:
```typescript
program
  .command('new-command')
  .description('Description of the new command')
  .argument('<required-arg>', 'Description')
  .option('-o, --optional <value>', 'Optional parameter')
  .action(async (requiredArg, options) => {
    try {
      await handleNewCommand(requiredArg, options);
    } catch (error) {
      console.error(`Error in new command: ${error.message}`);
      process.exit(1);
    }
  });
```

2. Implement handler function
3. Add comprehensive tests
4. Update help documentation

**Adding LLM Provider Support:**

1. Create provider interface in `src/types.ts`
2. Implement provider in new file (e.g., `src/providers/`)
3. Update configuration schema to support provider selection
4. Add tests with mocked providers
5. Update documentation

**Adding New Analysis Features:**

1. Extend `ServerCapabilities` or `LLMAnalysis` types
2. Update discovery logic in analyzer
3. Modify LLM prompts to handle new capabilities
4. Add configuration migration if needed
5. Test with various MCP servers

## Debugging and Troubleshooting

### Common Development Issues

**TypeScript Compilation Errors:**
```bash
# Check TypeScript errors
npx tsc --noEmit

# Common fix: Update type definitions
npm run build
```

**Test Failures:**
```bash
# Run specific test file
npm test -- analyzer.test.ts --verbose

# Debug test with node inspector
node --inspect-brk node_modules/.bin/jest analyzer.test.ts
```

**CLI Testing:**
```bash
# Test CLI in development
npm run dev -- analyze ./test-server.js

# Debug with full output
npm run dev -- analyze ./test-server.js --verbose
```

**MCP Server Connection Issues:**
```bash
# Test server independently
echo '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{}}' | node ./test-server.js

# Check server output
node ./test-server.js --help
```

### Debugging Tools

**VS Code Configuration (`.vscode/launch.json`):**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug CLI Analyze",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/cli.js",
      "args": ["analyze", "./simple-test-server.js"],
      "env": {
        "OPENAI_API_KEY": "${env:OPENAI_API_KEY}"
      },
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

**Logging:**
```typescript
// Add debug logging during development
const DEBUG = process.env.DEBUG === 'true';

function debugLog(message: string, data?: any) {
  if (DEBUG) {
    console.error(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}
```

**Testing with Real Servers:**
```bash
# Test against known MCP servers
git clone https://github.com/modelcontextprotocol/servers.git
cd servers/src/filesystem
npm install && npm run build

# Use with our analyzer
export OPENAI_API_KEY=your-key
mcp-context-saver analyze ../servers/src/filesystem/dist/index.js
```

## Release Process

### Version Management

**Semantic Versioning:**
- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes, backward compatible

**Pre-release Process:**
1. **Feature freeze**: No new features, only bug fixes
2. **Testing**: Extensive testing with various MCP servers
3. **Documentation**: Update all documentation
4. **Release candidate**: Tag with `-rc.1` suffix

**Release Checklist:**
- [ ] All tests pass
- [ ] Documentation is up to date  
- [ ] CHANGELOG.md is updated
- [ ] Version number is bumped in package.json
- [ ] Git tag is created
- [ ] npm package is published
- [ ] GitHub release is created

### Deployment

**NPM Publishing:**
```bash
# Build for production
npm run build

# Run final tests
npm test

# Publish to npm (requires npm login)
npm publish
```

**GitHub Release:**
1. Create release from tag
2. Include changelog in release notes
3. Attach built artifacts if needed

## Getting Help

**Communication Channels:**
- GitHub Issues: Bug reports and feature requests
- GitHub Discussions: Questions and general discussion
- Code Review: Pull request reviews and feedback

**Before Asking for Help:**
1. Check existing issues and documentation
2. Try the debugging steps above
3. Provide minimal reproduction case
4. Include relevant error messages and logs

**When Reporting Issues:**
- Node.js version
- npm version
- Operating system
- Complete error messages
- Steps to reproduce
- Expected vs actual behavior

**Useful Resources:**
- [Model Context Protocol Specification](https://modelcontextprotocol.io/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [Zod Validation Library](https://zod.dev/)

Thank you for contributing to MCP Context Saver! Your efforts help make MCP servers more accessible and powerful for everyone.