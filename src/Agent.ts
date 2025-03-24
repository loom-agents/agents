import OpenAI from "openai";
import { ResponseInputItem } from "openai/resources/responses/responses";
const openai = new OpenAI();

export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
  callback: (...args: any[]) => any;
  description: string;
}

export interface AgentConfig {
  name: string;
  purpose: string;
  sub_agents?: Agent[];
  tools?: ToolCall[];
  model?: string;
  web_search?: {
    enabled: boolean;
    config?: {
      search_context_size?: "high" | "medium" | "low";
      user_location?: {
        type?: "approximate";
        country?: string;
        city?: string;
        region?: string;
      };
    };
  };
}

const anything_to_string = (value: any) => {
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return value.toString();
};

export class Agent {
  private config: AgentConfig;
  private messages: ResponseInputItem[] = [];

  constructor(config: AgentConfig) {
    if (!config.purpose) throw new Error("Purpose is required");
    if (!config.name) throw new Error("Name is required");
    if (!config.model) config.model = "gpt-4o";

    this.config = config;

    if (this.config.sub_agents) {
      this.messages.push({
        role: "system" as const,
        content: `You can query the following 'sub_agents' with the 'CallSubAgent' tool: ${this.config.sub_agents
          .map((agent) => agent.config.name)
          .join(", ")}`,
      });
    }
  }

  async CallSubAgent(sub_agent: Agent, request: string) {
    return await sub_agent.run(request, 10);
  }

  private GetTools() {
    const toolsArray = [];
    if (this.config.tools) {
      toolsArray.push(
        ...this.config.tools.map((tool) => {
          return {
            type: "function" as const,
            name: tool.name,
            description: tool.description,
            parameters: {
              type: "object",
              properties: tool.parameters,
              required: Object.keys(tool.parameters),
              additionalProperties: false,
            },
            strict: true,
          };
        })
      );
    }

    if (this.config.sub_agents) {
      toolsArray.push({
        type: "function" as const,
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
        type: "web_search_preview" as const,
        config: this.config.web_search.config,
      });
    }

    return toolsArray;
  }

  async run(request: string, maxIterations: number = 10): Promise<string> {
    // Add the initial user request only once
    this.messages.push({
      role: "user" as const,
      content: request,
    });

    let iteration = 0;

    // Process the conversation in a loop
    while (iteration < maxIterations) {
      const result = await openai.responses.create({
        model: this.config.model as string,
        input: this.messages,
        instructions: `You are an AI Agent, your purpose is to (${this.config.purpose}). Consider using all the tools available to you to achieve this. Start acting immediately.`,
        tools: this.GetTools(),
      });

      // If there's a final output, return it
      if (result.output_text) {
        this.messages.push({
          role: "assistant" as const,
          content: result.output_text,
        });
        return result.output_text;
      }

      // Check if there are unprocessed function calls
      const hasFunctionCalls = result.output.some(
        (output: any) =>
          output.type === "function_call" &&
          !this.messages.some(
            (message) =>
              message.type === "function_call_output" &&
              message.call_id === output.call_id
          )
      );

      if (!hasFunctionCalls) {
        return "The agent completed without producing a final response. Or we do not support what it's trying to do.";
      }

      // Process each tool call
      for (const output of result.output) {
        this.messages.push(output);

        if (output.type === "function_call") {
          if (output.name === "CallSubAgent") {
            const args = JSON.parse(output.arguments);
            const sub_agent = this.config.sub_agents?.find(
              (agent) => agent.config.name === args.sub_agent
            );

            if (sub_agent) {
              console.log(
                `${this.config.name} agent calling sub-agent: ${sub_agent.config.name}`
              );
              const sub_agent_result = await this.CallSubAgent(
                sub_agent,
                args.request
              );
              this.messages.push({
                type: "function_call_output",
                call_id: output.call_id,
                output: sub_agent_result,
              });
            } else {
              console.log(
                `- Error: Sub-agent '${args.sub_agent}' not found. ${this.config.name} agent`
              );
              this.messages.push({
                type: "function_call_output",
                call_id: output.call_id,
                output: `Error: Sub-agent '${args.sub_agent}' not found.`,
              });
            }
          } else {
            const tool = this.config.tools?.find(
              (tool) => tool.name === output.name
            );

            if (tool) {
              console.log(
                `${this.config.name} agent calling tool: ${tool.name}`
              );
              const args = JSON.parse(output.arguments);
              const tool_result = tool.callback(args);
              this.messages.push({
                type: "function_call_output",
                call_id: output.call_id,
                output: anything_to_string(tool_result),
              });
            } else {
              console.log(
                `- Error: Tool '${output.name}' not found. ${this.config.name} agent`
              );
              this.messages.push({
                type: "function_call_output",
                call_id: output.call_id,
                output: `Error: Tool '${output.name}' not found.`,
              });
            }
          }
        }
      }

      iteration++;
    }

    return "Maximum iterations reached without producing a final response.";
  }
}
