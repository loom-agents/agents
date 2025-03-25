import OpenAI from "openai";
import { ResponseInputItem } from "openai/resources/responses/responses";
import { v4 } from "uuid";

const openai = new OpenAI();

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
  sub_agents?: Agent[];
  tools?: ToolCall[];
  model?: string;
  web_search?: WebSearchConfig;
  timeout_ms?: number;
}

const valueToString = (value: any): string => {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (error: Error | any) {
      return `[Object: Serialization Error - ${error.message}]`;
    }
  }

  return String(value);
};

export class AgentResponse {
  private status: "completed" | "error" | "pending" = "pending";
  private inputItems: ResponseInputItem[] = [];
  private outputItems: ResponseInputItem[] | ResponseInputItem;

  constructor(
    inputItems: ResponseInputItem[],
    outputItems: ResponseInputItem[] | ResponseInputItem,
    status: "completed" | "error" | "pending"
  ) {
    this.inputItems = inputItems;
    this.outputItems = outputItems;
    this.status = status;
  }

  public toStatus(): "completed" | "error" | "pending" {
    return this.status;
  }

  public toInputList(): ResponseInputItem[] {
    const outputItems = Array.isArray(this.outputItems)
      ? this.outputItems
      : [this.outputItems];

    return [...this.inputItems, ...outputItems];
  }

  public getContent(): string {
    if (this.status !== "completed") {
      return "";
    }

    return (this.outputItems as any).content;
  }
}

export class Agent {
  private config: AgentConfig;
  private defaultModel = "gpt-4o";
  private defaultTimeout = 60000;

  constructor(config: AgentConfig) {
    if (!config.purpose) throw new Error("Agent purpose is required");
    if (!config.name) throw new Error("Agent name is required");

    this.config = {
      ...config,
      model: config.model || this.defaultModel,
      timeout_ms: config.timeout_ms || this.defaultTimeout,
    };
  }

  private prepareTools(): any[] {
    const toolsArray = [];

    if (this.config.tools && this.config.tools.length > 0) {
      toolsArray.push(
        ...this.config.tools.map((tool) => ({
          type: "function",
          name: tool.name,
          description: tool.description,
          parameters: {
            type: "object",
            properties: tool.parameters,
            required: Object.keys(tool.parameters),
            additionalProperties: false,
          },
          strict: true,
        }))
      );
    }

    if (this.config.sub_agents && this.config.sub_agents.length > 0) {
      toolsArray.push({
        type: "function",
        name: "CallSubAgent",
        description:
          "Pass an input to a sub agent for processing and return the output",
        parameters: {
          type: "object",
          properties: {
            sub_agent: {
              type: "string",
              description: "The name of the sub agent to call",
              enum: this.config.sub_agents.map((agent) => agent.config.name),
            },
            request: {
              type: "string",
              description: "The request to send to the sub agent",
            },
          },
          required: ["sub_agent", "request"],
          additionalProperties: false,
        },
        strict: true,
      });
    }

    if (this.config.web_search?.enabled) {
      toolsArray.push({
        type: "web_search_preview",
        ...this.config.web_search.config,
      });
    }

    return toolsArray;
  }

  async run(input: string | ResponseInputItem[]): Promise<any> {
    const inputItems: ResponseInputItem[] = Array.isArray(input)
      ? input
      : [{ role: "user", content: input }];

    const result = await openai.responses.create({
      model: this.config.model as string,
      input: inputItems,
      instructions: `You are an AI Agent, your purpose is to (${
        this.config.purpose
      }). ${
        this.config.sub_agents && this.config.sub_agents.length > 0
          ? `You can query the following 'sub_agents' with the 'CallSubAgent' tool: {${this.config.sub_agents
              .map((agent) => `${agent.config.name}`)
              .join(", ")}}`
          : ""
      } Consider using all the tools available to you to achieve this. Start acting immediately.`,
      tools: this.prepareTools(),
    });

    if (result.output_text) {
      return new AgentResponse(
        inputItems,
        {
          role: "assistant",
          content: result.output_text,
        },
        "completed"
      );
    }

    const hasFunctionCalls = result.output.some(
      (output: any) =>
        output.type === "function_call" &&
        !inputItems.some(
          (message) =>
            message.type === "function_call_output" &&
            message.call_id === output.call_id
        )
    );

    if (!hasFunctionCalls) {
      const errorMsg =
        "The agent completed without producing a final response. Or we do not support what it's trying to do.";
      return new AgentResponse(
        inputItems,
        {
          role: "developer",
          content: errorMsg,
        },
        "error"
      );
    }

    const functionCalls: ResponseInputItem[] = [];
    for (const outputItem of result.output) {
      if (outputItem.type === "function_call") {
        const args = JSON.parse(outputItem.arguments);
        if (outputItem.name === "CallSubAgent") {
          const sub_agent = this.config.sub_agents?.find(
            (agent) => agent.config.name === args.sub_agent
          );

          if (!sub_agent) {
            throw new Error(`Sub-agent '${args.sub_agent}' not found.`);
          }

          const sub_agent_result: AgentResponse = await sub_agent.run([
            ...inputItems,
            {
              role: "user",
              content: `You were invoked with the follow request, as a sub-agent tool call - {${outputItem.arguments}}`,
            },
          ]);

          functionCalls.push({
            type: "function_call_output",
            call_id: outputItem.call_id,
            output:
              sub_agent_result.toStatus() !== "completed"
                ? `Error: ${sub_agent_result.toInputList()}`
                : sub_agent_result.getContent(),
          });
        } else {
          const tool = this.config.tools?.find(
            (tool) => tool.name === outputItem.name
          );

          if (!tool) {
            throw new Error(`Tool '${outputItem.name}' not found.`);
          }

          const result = await tool.callback(args);
          functionCalls.push({
            type: "function_call_output",
            call_id: outputItem.call_id,
            output: valueToString(result),
          });
        }
        inputItems.push(outputItem);
      }
    }

    return this.run([...inputItems, ...functionCalls]);
  }

  public clone(config?: Partial<AgentConfig>): Agent {
    return new Agent({
      ...this.config,
      ...config,
    });
  }

  public asTool(parameters?: object): ToolCall {
    return {
      name: this.config.name.replace(/[^a-zA-Z0-9_-]/g, ""),
      parameters: parameters
        ? parameters
        : {
            request: {
              type: "string",
              description: `Request to send to the ${this.config.name.replace(
                /[^a-zA-Z0-9_-]/g,
                ""
              )} agent`,
            },
          },
      callback: async (...args) => {
        return await this.run(
          `You were invoked as a tool with the following request - ${JSON.stringify(
            args
          )}`
        );
      },
      description: this.config.purpose,
    };
  }
}
