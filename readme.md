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
- **Hierarchical Composition**: Build complex systems by composing agents into parent/child relationships
- **Tool Integration**: Extend agent capabilities by adding custom tools
- **Web Search**: Enable agents to perform web searches for real-time information
- **Automatic Recursion Management**: Built-in protection against infinite loops
- **Multi-Turn Agency**: Agents can plan, ask for clarification, and then execute. 

## Installation

```bash
$ bun i loom-agents
```

## Quick Start

```typescript
import { Agent, Runner } from "loom-agents";

async function main() {
  // Create a simple agent
  const greetingAgent = new Agent({
    name: "Greeting Agent",
    purpose: "Generate friendly greetings",
  });

  const runner = new Runner(greetingAgent);
  const result = await runner.run("Say hello to the user");
  console.log(result);
}

main().catch(console.error);
```

## Example Projects

### Loom-Agents Code: Open Source Coding CLI Agent

[Loom-Agents Code](https://github.com/loom-agents/loom-agents-code) is an open source CLI agent designed for coding tasks, similar to Claude Code. This project demonstrates how to use the LOOM framework to orchestrate multiple specialized agents for tasks like code generation, debugging, code review, and documentation. It serves as a practical example of building a composable, hierarchical AI system that can efficiently manage coding-related workflows.

## Creating Hierarchical Agent Systems

Agents can be composed hierarchically, with parent agents delegating tasks to specialized child agents:

```typescript
import { Agent, Runner } from "loom-agents";

async function main() {
  // Create specialized tutor agents
  const mathTutorAgent = new Agent({
    name: "Math Tutor",
    purpose:
      "You provide help with math problems. Explain your reasoning at each step and include examples",
  });

  const historyTutorAgent = new Agent({
    name: "History Tutor",
    purpose:
      "You provide assistance with historical queries. Explain important events and context clearly",
  });

  // Create the triage agent with sub-agents
  const triageAgent = new Agent({
    name: "Triage Agent",
    purpose:
      "Determine which agent to use based on the user's homework question",
    sub_agents: [mathTutorAgent, historyTutorAgent],
  });

  const runner = new Runner(triageAgent);

  // Test the implementation
  const result1 = await runner.run("What is 2 + 2?");
  console.log("Result 1:", result1);

  const result2 = await runner.run(
    "Who was the best president in American history?"
  );
  console.log("Result 2:", result2);
}

main().catch(console.error);
```

## Adding Custom Tools

Extend agents with custom tools to interact with external systems:

```typescript
import { Agent, Runner, ToolCall } from "loom-agents";

async function main() {
  const timeAgent = new Agent({
    name: "TimeAgent",
    purpose: "Get the current time and handle time operations",
    tools: [
      {
        name: "GetTime",
        description: "Get the current time",
        parameters: {},
        callback: () => {
          const time = new Date().toLocaleTimeString();
          return {
            success: true,
            message: "Retrieved current time",
            data: time,
          };
        },
      },
    ],
  });

  const farewellAgent = new Agent({
    name: "Farewell Agent",
    purpose: "Generate a contextual farewell message",
    sub_agents: [timeAgent],
  });

  const runner = new Runner(farewellAgent);
  const result = await runner.run("Say goodbye with the current time");

  console.log(result);
}

main().catch(console.error);
```

## Using Agents as Tools

You can use agents as tools for other agents, allowing for flexible composition:

```typescript
import { Agent, Runner, ToolCall } from "loom-agents";

async function main() {
  const translationAgent = new Agent({
    name: "Translation Agent",
    purpose:
      "I translate text into different languages, just let me know the language you want to translate to.",
  });

  const greetingAgent = new Agent({
    name: "Greeting Agent",
    purpose: "Generate a greeting",
    tools: [
      translationAgent.asTool({
        request: {
          type: "string",
          description: `The text to translate`,
        },
        language: {
          type: "string",
          description: `The language to translate to`,
        },
      }),
    ],
  });

  const runner = new Runner(greetingAgent);
  const result = await runner.run("Say hello to the user in spanish");
  console.log(result);
}

main().catch(console.error);
```

## Enabling Web Search

Give your agents access to real-time information from the web:

```typescript
import { Agent, Runner } from "loom-agents";

async function main() {
  const researchAgent = new Agent({
    name: "Research Agent",
    purpose: "Find up-to-date information on topics",
    web_search: {
      enabled: true,
      config: {
        search_context_size: "medium",
        user_location: {
          type: "approximate",
          country: "US",
        },
      },
    },
  });

  const runner = new Runner(researchAgent);
  const result = await runner.run(
    "Find information on the best restaurants in New York City"
  );

  console.log(result);
}

main().catch(console.error);
```

## Building Complex Research Systems

Combine multiple agents with different capabilities to create powerful research systems:

```typescript
import { Agent, Runner } from "loom-agents";

async function main() {
  const researchAgent = new Agent({
    name: "Research Agent",
    purpose: "Gather information on topics",
    web_search: {
      enabled: true,
    },
  });

  const writingAgent = new Agent({
    name: "Writing Agent",
    purpose: "Create well-structured content based on research",
  });

  const factCheckAgent = new Agent({
    name: "Fact Check Agent",
    purpose: "Verify factual accuracy of content",
    web_search: {
      enabled: true,
    },
  });

  // Create the content production system
  const deepResearchAgent = new Agent({
    name: "Content Creation Agent",
    purpose: "Produce high-quality, factually accurate articles.",
    sub_agents: [researchAgent, writingAgent, factCheckAgent],
  });

  const runner = new Runner(deepResearchAgent);
  const result = await runner.run(
    "Create an article about recent advances in renewable energy, include citations from the researcher. Fact check your work."
  );

  console.log(result);
}

main().catch(console.error);
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

## License

MIT
