# MCP Context Saver Architecture

## Overview

MCP Context Saver implements a two-phase approach to enhance Model Context Protocol (MCP) servers with intelligent LLM-powered coordination. The system analyzes existing MCP servers to understand their capabilities and creates wrapper servers that provide unified expert interfaces.

## System Architecture

### High-Level Design

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Server    │───▶│    Analyzer     │───▶│ Expert Config   │
│   (Any Server)  │    │                 │    │   (JSON File)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                         │
                              ▼                         ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  LLM Analysis   │    │ Wrapper Server  │
                       │   (OpenAI)      │    │  (Expert Tool)  │
                       └─────────────────┘    └─────────────────┘
```

### Two-Phase Architecture

#### Phase 1: Analysis (Setup Time)
The analyzer discovers and characterizes MCP server capabilities:

1. **Connection**: Establishes STDIO transport to target MCP server
2. **Discovery**: Interrogates server for tools, resources, and prompts  
3. **Analysis**: Uses LLM to understand server purpose and generate system prompts
4. **Configuration**: Saves expert configuration for runtime use

#### Phase 2: Runtime (Service Time)
The wrapper provides intelligent coordination between users and the wrapped server:

1. **Expert Interface**: Single tool that accepts natural language queries
2. **LLM Coordination**: Uses OpenAI to interpret requests and plan tool usage
3. **Execution**: Calls underlying MCP server tools based on LLM planning
4. **Response**: Returns structured results to the client

## Core Components

### 1. Analyzer (`src/analyzer.ts`)

The analyzer is responsible for the discovery and characterization phase.

**Key Functions:**
- `analyzeServer()` - Main entry point for analysis workflow
- `connectToServer()` - Establishes connection to target MCP server
- `discoverCapabilities()` - Interrogates server for available functionality
- `analyzeWithLLM()` - Uses OpenAI to generate expert configuration
- `saveConfiguration()` - Persists configuration to JSON file

**Data Flow:**
```
MCP Server → Connection → Capability Discovery → LLM Analysis → Config File
```

**Error Handling:**
- Connection validation with detailed error messages
- Graceful handling of partial server capabilities (e.g., no resources)
- Environment validation (OpenAI API key)
- Clean resource cleanup on failures

### 2. Wrapper (`src/wrapper.ts`)

The wrapper provides the runtime coordination layer that transforms any MCP server into an intelligent expert.

**Key Functions:**
- `startWrapperServer()` - Main server entry point
- `loadConfig()` - Loads and validates configuration files
- `createExpertTool()` - Generates the unified expert tool definition
- `connectToWrappedServer()` - Maintains connection to the wrapped server
- `handleExpertQuery()` - Coordinates between user queries and server tools

**Operation Modes:**

1. **Discover Mode**: Returns capability summaries
   ```json
   {
     "summary": "File System Expert provides 8 tools, 2 resources, and 1 prompts",
     "tools": [...],
     "resources": [...],
     "prompts": [...]
   }
   ```

2. **Execute Mode** (Default): Performs intelligent tool coordination
   ```json
   {
     "explanation": "I'll list the files in the specified directory",
     "results": [
       {
         "tool": "list_files",
         "result": [...]
       }
     ]
   }
   ```

3. **Explain Mode**: Returns expert metadata and usage information
   ```json
   {
     "description": "Expert for managing files and directories",
     "systemPrompt": "You are a file system expert...",
     "availableTools": "list_files, read_file, write_file",
     "usage": "Ask me to perform tasks and I'll use the appropriate tools"
   }
   ```

### 3. CLI Interface (`src/cli.ts`)

Provides user-friendly command-line access to both phases.

**Commands:**
- `analyze <server-path> [args...]` - Runs analysis phase
- `serve <config-path>` - Starts wrapper server with configuration

**Error Handling:**
- Environment validation with helpful guidance
- Server connection troubleshooting
- Configuration file validation

### 4. Type System (`src/types.ts`)

Comprehensive TypeScript types with Zod validation for runtime safety.

**Key Types:**
- `ServerCapabilities` - Raw server capability data
- `LLMAnalysis` - Structured analysis results from OpenAI
- `ServerConfig` - Complete configuration file structure
- `WrapperConfig` - Runtime-validated configuration
- `ExpertToolInput` - Validated expert tool parameters

## LLM Coordination System

### Analysis LLM Usage

The analyzer uses OpenAI GPT-4o-mini to generate expert configurations:

**Input:** Complete server capabilities (tools, resources, prompts)
**Output:** Structured JSON with expert identity and system prompt
**Temperature:** 0.3 (consistent but not completely deterministic)

**Example Analysis Prompt:**
```
You are analyzing an MCP server's capabilities to generate an expert tool configuration.

The server provides the following capabilities:
TOOLS (8): [detailed tool descriptions]
RESOURCES (2): [resource descriptions]  
PROMPTS (1): [prompt descriptions]

Generate a JSON configuration with:
- expertName: Concise descriptive name
- expertDescription: Clear capability description
- systemPrompt: LLM guidance for coordination
- capabilities: Structured capability lists
```

### Runtime LLM Usage

The wrapper uses OpenAI GPT-4o-mini for request coordination:

**Input:** User query + available tools + expert system prompt
**Output:** Execution plan with tool calls and explanations
**Temperature:** 0.3 (consistent planning)

**Example Coordination Prompt:**
```
[Expert System Prompt]

Available tools: [tool definitions]
User query: "Find all JavaScript files larger than 1MB"

Determine which tools to use and with what arguments.
Respond with JSON: {
  "toolCalls": [{"name": "...", "arguments": {...}}],
  "explanation": "..."
}
```

## Configuration System

### Configuration File Structure

Generated configurations include complete metadata for reproducible deployments:

```json
{
  "name": "File System Expert",
  "description": "Comprehensive file and directory management",
  "serverPath": "/path/to/server",
  "args": ["--option", "value"],
  "systemPrompt": "You are a file system expert with capabilities to...",
  "capabilities": {
    "tools": [/* full tool definitions */],
    "resources": [/* resource definitions */],
    "prompts": [/* prompt definitions */]
  },
  "metadata": {
    "analyzedAt": "2023-12-07T10:30:00.000Z",
    "toolCount": 8,
    "resourceCount": 2,
    "promptCount": 1
  }
}
```

### Configuration Validation

Uses Zod schemas for runtime validation:
- Type safety for configuration loading
- Clear error messages for invalid configurations
- Prevents runtime errors from malformed configurations

## Transport and Protocol

### MCP Protocol Compliance

Both analyzer and wrapper are fully compliant MCP implementations:

- **STDIO Transport**: Standard input/output communication
- **JSON-RPC 2.0**: Proper request/response formatting
- **Standard Methods**: `initialize`, `tools/list`, `tools/call`, etc.
- **Error Handling**: Proper JSON-RPC error responses

### Connection Management

**Analyzer Connections:**
- Temporary connections for capability discovery
- Proper cleanup after analysis completion
- Timeout handling for unresponsive servers

**Wrapper Connections:**
- Persistent connection to wrapped server during operation
- Clean shutdown handling (SIGINT)
- Connection recovery strategies

## Security Considerations

### API Key Management

- Environment variable validation before operations
- No hardcoded credentials in code or configurations
- Clear error messages for missing API keys

### Input Validation

- Zod schemas for all runtime inputs
- Sanitization of file paths and server arguments
- Validation of JSON parsing operations

### Error Information

- Sanitized error messages to prevent information leakage
- Structured error responses following MCP conventions
- Graceful degradation for partial failures

## Scalability and Performance

### Analysis Phase Performance

- Parallel capability discovery where possible
- Efficient JSON parsing and validation
- Minimal memory footprint for large server capabilities

### Runtime Performance

- Single persistent connection to wrapped server
- Streaming JSON-RPC communication
- Minimal LLM calls per user request (typically 1-2)

### Resource Management

- Automatic cleanup of temporary connections
- Proper process lifecycle management
- Memory-efficient configuration loading

## Testing Strategy

### Unit Tests
- Individual component testing
- Mock LLM responses for deterministic testing
- Error condition coverage

### Integration Tests  
- Full end-to-end workflow testing
- Mock MCP server for reproducible tests
- Real LLM integration testing (when API keys available)

### Test Structure
```
tests/
├── unit/
│   ├── analyzer.test.ts      # Analyzer component tests
│   └── wrapper.test.ts       # Wrapper component tests
└── integration/
    ├── full-flow.test.ts     # End-to-end testing
    ├── mock-server.ts        # Test MCP server implementation
    └── mock-server.js        # Simple test server
```

## Future Architecture Considerations

### Multi-LLM Support
- Abstract LLM interface for provider flexibility
- Configuration-driven LLM selection
- Fallback strategies for LLM failures

### Enhanced Coordination
- Multi-step planning for complex operations
- State management for conversational interactions
- Tool result caching for efficiency

### Distributed Deployment
- Configuration for remote MCP servers
- Load balancing for high-throughput scenarios
- Health monitoring and automatic recovery

### Advanced Analysis
- Semantic analysis of tool relationships
- Automated system prompt optimization
- Performance profiling of wrapped servers