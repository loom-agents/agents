# Loom Agents Library - LLM Helper

```index.ts
export * from "./Agents/Agent";
export * from "./Loom/Loom";
export * from "./Runner/Runner";
export * from "./Trace/Trace";
```
import ... from `loom-agents`;

```Agent
export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
  callback: (...args: any[]) => any;
  description: string;
}

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

export interface AgentConfig {
  name: string;
  purpose: string;
  sub_agents?: Agent[]; // Sub Agents do push `Context` messages into the hierarchy
  tools?: ToolCall[];
  model?: string;
  web_search?: WebSearchConfig;
  timeout_ms?: number;
}

export interface AgentRequest<T> {
  context: T[];
}

export interface AgentResponse<T> {
  status: string;
  final_message: string;
  context: T[];
}

export class Agent {
  public uuid: string;
  constructor(config: AgentConfig)
  async run(input: string | AgentRequest<ResponseInputItem | ChatCompletionMessageParam>, trace?: Trace ): Promise<AgentResponse<ResponseInputItem | ChatCompletionMessageParam>>
  public asTool(parameters: object): ToolCall; // Agents `asTool`s do not push `Context` messages into the hierarchy 
}
```

```Loom
export interface ConfigOptions {
  api?: "completions" | "responses";
  openai_config?: ClientOptions;
}

const config: ConfigOptions = {
  api: "responses",
  openai_config: {},
};

export const Loom = {
  get api(): ConfigOptions["api"]
  set api(value: ConfigOptions["api"])
  get openai_config(): ConfigOptions["openai_config"]
  set openai_config(value: ConfigOptions["openai_config"])
  get config(): ConfigOptions
  get openai()
};
```

```Trace
export interface TraceDetails {
  name: string;
  uuid: string;
  data: any;
  startTime: number;
  endTime?: number;
  children: TraceDetails[];
}

export class Trace {
  constructor(name: string, data: any, parent?: Trace)
  public start(name: string, data: any): Trace
  public end(): number
  public getDetails(): TraceDetails
  public render(indent: string = "", last: boolean = true): string
}
```

```Runner
export interface RunnerConfig {
  max_depth?: number;
  name?: string;
  id?: string;
  context?: Record<string, any>;
}

export interface RunnerResponse<T> extends AgentResponse<T> {
  trace: Trace;
}

export class Runner {
  constructor(agent: Agent, config: RunnerConfig = {})
  async run(input: string | AgentRequest<ResponseInputItem> | AgentRequest<ChatCompletionMessageParam>) : Promise<RunnerResponse<ResponseInputItem | ChatCompletionMessageParam>>
  public getTraces(): Trace[]
}
```

## Example Code

```examples/agent-deligation.ts
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

```examples/deep-researcher.ts
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

```examples/mixed-agent.ts
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

```examples/simple-agent.ts
import { Agent, Runner } from "loom-agents";

async function main() {
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

```examples/using-tools.ts
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

```examples/web-search.ts
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
