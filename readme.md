# LOOM – Lightweight Orchestration Of Multiple Agents

**LOOM** is a minimalist framework for building hierarchical, composable AI agent systems powered by OpenAI.

Designed for developers and researchers who want full control with zero bloat, LOOM provides the essential primitives for building intelligent, purposeful agents that can think, act, and collaborate.

---

## Overview

LOOM makes it simple to define AI agents that:

- Pursue goals and complete tasks
- Use external tools and APIs
- Form complex hierarchies with parent/child behavior
- Access live data via web search
- Avoid infinite loops with automatic recursion guards

Whether you're building a self-healing coding assistant, a research pipeline, or a swarm of interconnected agents — LOOM gives you the scaffolding to do it with clarity and control.

---

## Features

- **Composable Agent Architecture** – Define agents with distinct roles and capabilities  
- **Hierarchical Composition** – Parent agents can route tasks to specialized children  
- **Custom Tooling** – Plug in functions and external APIs as callable tools  
- **Web Search Integration** – Pull real-time data into your agent's context  
- **Recursion Protection** – Prevent runaway loops and infinite delegation  
- **Multi-Turn Interaction** – Let agents plan, clarify, and act in sequence  
- **MCP Compatible** – Plug into the [Model Context Protocol](https://modelcontextprotocol.io/introduction) for tool-rich agent networks  
- **Cross-API Bridging** – Share context between Completions and Chat models (*experimental*)  
  > ⚠️ Note: [OpenAI currently has a bug](https://github.com/loom-agents/agents/blob/main/TODO.md#openai-bugs) that affects the Completions API which could be problematic.

> *Experimental features are functional and actively improving.*

---

## Installation

```bash
bun i loom-agents
```

---

## Quick Start

```ts
import { Agent, Runner } from "loom-agents";

const agent = new Agent({
  name: "Greeting Agent",
  purpose: "Generate friendly greetings",
});

const runner = new Runner(agent);

const result = await runner.run("Say hello to the user");
console.log(result);
```

---

## Example Projects

### [loom-agents-code](https://github.com/loom-agents/loom-agents-code)
A CLI agent for code generation, refactoring, and debugging — built entirely with LOOM. Think Claude Code, but open-source and composable.

---

## Hierarchical Agent Systems

Agents can call other agents. Here’s a homework helper that delegates to subject-specific tutors:

```ts
const mathTutor = new Agent({ name: "Math Tutor", purpose: "Explain math with examples." });
const historyTutor = new Agent({ name: "History Tutor", purpose: "Answer historical questions." });

const triageAgent = new Agent({
  name: "Triage Agent",
  purpose: "Route questions to the appropriate tutor",
  sub_agents: [mathTutor, historyTutor],
});
```

---

## Tools & Integrations

Agents can be extended with custom tools:

```ts
tools: [
  {
    name: "GetTime",
    description: "Returns the current time",
    callback: () => new Date().toLocaleTimeString(),
  }
]
```

Agents can also become tools themselves — a powerful way to modularize behavior.

---

## Web Search

Need live data? Enable web search:

```ts
web_search: {
  enabled: true,
  config: {
    search_context_size: "medium",
    user_location: { type: "approximate", country: "US" },
  }
}
```

---

## Complex Systems in 20 Lines

Orchestrate research, writing, and fact-checking with composable agents:

```ts
const deepResearchAgent = new Agent({
  name: "Content Creator",
  purpose: "Write fact-checked articles",
  sub_agents: [researchAgent, writingAgent, factCheckAgent],
});
```

LOOM handles delegation, recursion, and context sharing for you.

---

## Agent Options

| Key           | Type       | Description |
|---------------|------------|-------------|
| `name`        | `string`   | Display name of the agent *(required)* |
| `purpose`     | `string`   | The agent’s primary task *(required)* |
| `model`       | `string`   | OpenAI model to use (default: `"gpt-4o"`) |
| `sub_agents`  | `Agent[]`  | Child agents this agent can delegate to |
| `tools`       | `ToolCall[]` | Tools this agent can call |
| `web_search`  | `object`   | Enable and configure real-time search |

---

## License

MIT — simple and open, like LOOM itself.
