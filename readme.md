# LOOM ([L]ightweight [O]rchestration [O]f [M]ultiple agents)

A lightweight, composable framework for building hierarchical AI agent systems using OpenAI's API.

## Overview

This project provides a simple yet powerful way to create AI agents that can:
- Execute specific tasks based on defined purposes
- Use tools to interact with external systems
- Organize into hierarchical structures with parent/child relationships
- Perform web searches to access real-time information

## Features

- **Agent-Based Architecture**: Create specialized agents with distinct purposes and capabilities
- **Hierarchical Composition**: Build complex systems by composing agents into parent-child relationships
- **Tool Integration**: Extend agent capabilities by adding custom tools
- **Web Search**: Enable agents to perform web searches for real-time information
- **Automatic Recursion Management**: Built-in protection against infinite loops

## Installation

```bash
npm install openai-agent-framework
```

## Quick Start

```typescript
import { Agent } from "./Agent";

async function main() {
  // Create a simple agent
  const greetingAgent = new Agent({
    name: "Greeting Agent",
    purpose: "Generate friendly greetings",
  });

  // Run the agent with a request
  const result = await greetingAgent.run("Say hello to the user");
  console.log(result);
}

main().catch(console.error);
```

## Creating Hierarchical Agent Systems

Agents can be composed hierarchically, with parent agents delegating tasks to specialized child agents:

```typescript
// Create specialized agents
const mathTutor = new Agent({
  name: "Math Tutor",
  purpose: "Provide step-by-step math problem solutions",
});

const historyTutor = new Agent({
  name: "History Tutor",
  purpose: "Explain historical events with proper context",
});

// Create a parent agent that delegates to specialized agents
const educationAgent = new Agent({
  name: "Education Agent",
  purpose: "Direct education questions to the appropriate specialist",
  sub_agents: [mathTutor, historyTutor],
});

// The parent agent will automatically route questions to the appropriate sub-agent
const result = await educationAgent.run("What is the quadratic formula?");
```

## Adding Custom Tools

Extend agents with custom tools to interact with external systems:

```typescript
const weatherAgent = new Agent({
  name: "Weather Agent",
  purpose: "Provide weather information",
  tools: [
    {
      name: "GetCurrentWeather",
      description: "Get the current weather for a location",
      parameters: {
        location: {
          type: "string",
          description: "The city and state, e.g., 'San Francisco, CA'",
        },
      },
      callback: (args) => fetchWeatherData(args.location),
    },
  ],
});
```

## Enabling Web Search

Give your agents access to real-time information from the web:

```typescript
const researchAgent = new Agent({
  name: "Research Agent",
  purpose: "Find up-to-date information on topics",
  web_search: { 
    enabled: true,
    config: {
      search_context_size: "medium",
      user_location: {
        country: "US",
      },
    },
  },
});
```

## Agent Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Name of the agent (required) |
| `purpose` | string | The agent's primary objective (required) |
| `model` | string | OpenAI model to use (default: "gpt-4o") |
| `sub_agents` | Agent[] | Child agents that can be called by this agent |
| `tools` | ToolCall[] | Custom tools the agent can use |
| `web_search` | object | Web search configuration |

## Examples

### Task Delegation System

```typescript
// Create specialized agents for different tasks
const codeReviewAgent = new Agent({
  name: "Code Review Agent",
  purpose: "Review code for bugs and best practices",
});

const documentationAgent = new Agent({
  name: "Documentation Agent",
  purpose: "Generate documentation for code",
});

// Create a project manager agent that delegates to specialized agents
const projectManager = new Agent({
  name: "Project Manager",
  purpose: "Coordinate software development tasks",
  sub_agents: [codeReviewAgent, documentationAgent],
});
```

### Agent with Custom Tools

```typescript
const timeAgent = new Agent({
  name: "Time Agent",
  purpose: "Provide time-related information",
  tools: [
    {
      name: "GetCurrentTime",
      description: "Get the current time",
      parameters: {},
      callback: () => new Date().toLocaleTimeString(),
    },
    {
      name: "CalculateTimeDifference",
      description: "Calculate the time difference between two time zones",
      parameters: {
        timezone1: { type: "string" },
        timezone2: { type: "string" },
      },
      callback: (args) => calculateTimeDifference(args.timezone1, args.timezone2),
    },
  ],
});
```

## License

MIT
