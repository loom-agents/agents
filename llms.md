# Loom Agents Library - LLM Helper

## Core Interfaces

```typescript
// Agent Configuration
export interface AgentConfig {
  name: string;                         // Required: Agent name
  purpose: string;                      // Required: What the agent does
  sub_agents?: Agent[];                 // Optional: Child agents
  tools?: ToolCall[];                   // Optional: Tools the agent can use
  model?: string;                       // Optional: Default "gpt-4o"
  web_search?: WebSearchConfig;         // Optional: Web search settings
  timeout_ms?: number;                  // Optional: Default 60000ms
}

// Web Search Configuration
export interface WebSearchConfig {
  enabled: boolean;
  config?: {
    search_context_size?: "high" | "medium" | "low";
    user_location?: {
      type: "approximate";
      country?: string;
      city?: string;
      region?: string;
    };
  };
}

// Tool Definition
export interface ToolCall {
  name: string;                         // Tool name
  parameters: Record<string, any>;      // Tool parameters
  callback: (...args: any[]) => any;    // Function to execute
  description: string;                  // What the tool does
}

// Runner Configuration
export interface RunnerConfig {
  max_depth?: number;                   // Max recursion depth
  name?: string;                        // Runner name
  id?: string;                          // Unique ID
  context?: Record<string, any>;        // Additional context
}
```

## Class Methods

```typescript
// Agent Class
export class Agent {
  constructor(config: AgentConfig);
  
  // Run the agent with input
  async run(input: string | ResponseInputItem[]): Promise<AgentResponse>;
  
  // Create a new agent with modified config
  public clone(config?: Partial<AgentConfig>): Agent;
  
  // Convert this agent to a tool for another agent
  public asTool(parameters?: object): ToolCall;
}

// Runner Class
export class Runner {
  constructor(agent: Agent, config?: RunnerConfig);
  
  // Execute the agent
  async run(input: string | ResponseInputItem[]): Promise<AgentResponse>;
  
  // Get conversation history
  public GetMessages(): ResponseInputItem[];
  
  // Get execution trace
  public GetTrace(): Tracing;
  
  // Get hierarchical trace
  public GetHierarchicalTrace(): Record<string, any>;
  
  // Export trace for visualization
  public ExportTrace(): Record<string, any>;
}

// Tracing Class
export class Tracing {
  constructor(config?: TracingConfig);
  
  // Begin a new action
  public StartAction(action: string, parameters?: Record<string, any>, parent_id?: string): string;
  
  // Complete an action
  public FinishAction(id: string, result: string, status?: "success" | "error" | "cancelled"): void;
  
  // Record a log message
  public LogRaw(message: string, parent_id?: string): string;
  
  // Get all logs
  public GetLog(): TracingAction[];
  
  // Create nested tracing context
  public CreateChildTracing(context?: Record<string, any>): Tracing;
}
```

## Usage Example

```typescript
import { Agent, Runner } from "loom-agents";

// Create a research agent with web search
const agent = new Agent({
  name: "Research",
  purpose: "Find information on topics",
  web_search: { enabled: true }
});

// Setup a runner with default configuration
const runner = new Runner(agent);

// Execute the agent and get results
const result = await runner.run("Tell me about quantum computing");
console.log(result.getContent());
```
