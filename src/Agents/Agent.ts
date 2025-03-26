import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat";
import {
  FunctionTool,
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputMessage,
  Tool,
} from "openai/resources/responses/responses";
import { Loom } from "../Loom/Loom";

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
  mode?: "responses" | "completions";
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

export interface AgentRequest<T> {
  context: T[];
}

export class Agent {
  private config: AgentConfig;
  private defaultModel = "gpt-4o";
  private defaultTimeout = 60000;

  constructor(config: AgentConfig) {
    if (!config.purpose) throw new Error("Agent purpose is required");
    if (!config.name) throw new Error("Agent name is required");
    if (!config.model) config.mode = "completions";

    this.config = {
      ...config,
      model: config.model || this.defaultModel,
      timeout_ms: config.timeout_ms || this.defaultTimeout,
    };
  }

  private prepareTools(): Tool[] {
    const toolsArray = [];

    if (this.config.tools && this.config.tools.length > 0) {
      toolsArray.push(
        ...this.config.tools.map((tool) => ({
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
        }))
      );
    }

    if (this.config.sub_agents && this.config.sub_agents.length > 0) {
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
        ...this.config.web_search.config,
      });
    }

    return toolsArray;
  }

  private ToolsToCompletionTools(
    tools: Tool[]
  ): ChatCompletionTool[] | undefined {
    if (!tools || tools.length === 0) return undefined;

    const toolsArray: ChatCompletionTool[] = [];
    toolsArray.push(
      ...tools
        .filter((tool: Tool) => tool.type === "function")
        .map((tool: FunctionTool) => {
          return {
            type: "function" as const,
            function: {
              name: tool.name,
              description: tool.description as string,
              parameters: tool.parameters,
              strict: tool.strict,
            },
          };
        })
    );

    return toolsArray;
  }

  private async run_completions(
    input: string | AgentRequest<ChatCompletionMessageParam>
  ): Promise<{
    status: string;
    final_message: string;
    context: ChatCompletionMessageParam[];
  }> {
    const context: ChatCompletionMessageParam[] =
      typeof input === "string"
        ? [{ content: input, role: "user" }]
        : input.context;

    const response = await Loom.openai.chat.completions.create({
      model: this.config.model as string,
      messages: [
        {
          role: "system",
          content: `You are an AI Agent, your purpose is to (${
            this.config.purpose
          }). ${
            this.config.sub_agents && this.config.sub_agents.length > 0
              ? `You can query the following 'sub_agents' with the 'CallSubAgent' tool: {${this.config.sub_agents
                  .map((agent) => `${agent.config.name}`)
                  .join(", ")}}`
              : ""
          } Consider using all the tools available to you to achieve this. Start acting immediately.`,
        },
        ...context,
      ] as ChatCompletionMessageParam[],
      tools: this.ToolsToCompletionTools(this.prepareTools()),
      web_search_options: this.config.web_search?.enabled
        ? {
            search_context_size:
              this.config.web_search.config?.search_context_size,
            user_location: {
              type: this.config.web_search.config?.user_location
                ?.type as "approximate",
              approximate: {
                city: this.config.web_search.config?.user_location?.city,
                country: this.config.web_search.config?.user_location?.country,
                region: this.config.web_search.config?.user_location?.region,
              },
            },
          }
        : undefined,
    });

    if (response.choices[0].finish_reason === "stop") {
      return {
        status: "completed",
        final_message: response.choices[0].message.content as string,
        context: context,
      };
    }

    if (response.choices[0].finish_reason === "content_filter") {
      return {
        status: "error",
        final_message:
          "[Content Filter] " + response.choices[0].message.content,
        context: context,
      };
    }

    if (response.choices[0].finish_reason === "length") {
      return {
        status: "error",
        final_message: "[Length] " + response.choices[0].message.content,
        context: context,
      };
    }

    if (response.choices[0].finish_reason === "function_call") {
      return {
        status: "error",
        final_message: "[Function Call] Not implemented",
        context: context,
      };
    }

    const call_results: ChatCompletionToolMessageParam[] = [];
    if (response.choices[0].finish_reason === "tool_calls") {
      const tool_calls = response.choices[0].message.tool_calls;
      if (tool_calls && tool_calls.length > 0) {
        for (const tool_call of tool_calls) {
          if (tool_call.function.name === "CallSubAgent") {
            const args = JSON.parse(tool_call.function.arguments);
            const sub_agent = this.config.sub_agents?.find(
              (agent) => agent.config.name === args.sub_agent
            );

            if (!sub_agent) {
              call_results.push({
                role: "tool" as const,
                tool_call_id: tool_call.id,
                content: `[Sub Agent Error] ${args.sub_agent} - Sub Agent not found`,
              });
              continue;
            }

            const result = await sub_agent.run({
              context: [
                ...context,
                {
                  role: "user",
                  content: args.request,
                },
              ],
            });

            call_results.push({
              role: "tool" as const,
              tool_call_id: tool_call.id,
              content: result.final_message,
            });
          } else {
            const tool = this.config.tools?.find(
              (tool) => tool.name === tool_call.function.name
            );

            if (!tool) {
              call_results.push({
                role: "tool" as const,
                tool_call_id: tool_call.id,
                content: `[Tool Call Error] ${tool_call.function.name} - Tool not found`,
              });
              continue;
            }

            try {
              const result = await tool.callback(
                JSON.parse(tool_call.function.arguments)
              );
              call_results.push({
                role: "tool" as const,
                tool_call_id: tool_call.id,
                content: valueToString(result),
              });
            } catch (error: Error | any) {
              call_results.push({
                role: "tool" as const,
                tool_call_id: tool_call.id,
                content: `[Tool Call Error] ${tool_call.function.name} - ${error.message}`,
              });
            }
          }
        }
      }
    }

    return this.run_completions({
      context: [
        ...context,
        ...response.choices.map((choice) => choice.message),
        ...call_results,
      ],
    });
  }

  private async run_responses(
    input: string | AgentRequest<ResponseInputItem>
  ): Promise<{
    status: string;
    final_message: string;
    context: ResponseInputItem[];
  }> {
    const context: ResponseInputItem[] =
      typeof input === "string"
        ? [{ content: input, role: "user" }]
        : input.context;

    const response = await Loom.openai.responses.create({
      model: this.config.model as string,
      input: [
        {
          role: "system",
          content: `You are an AI Agent, your purpose is to (${
            this.config.purpose
          }). ${
            this.config.sub_agents && this.config.sub_agents.length > 0
              ? `You can query the following 'sub_agents' with the 'CallSubAgent' tool: {${this.config.sub_agents
                  .map((agent) => `${agent.config.name}`)
                  .join(", ")}}`
              : ""
          } Consider using all the tools available to you to achieve this. Start acting immediately.`,
        },
        ...context,
      ] as ResponseInputItem[],
      tools: this.prepareTools(),
    });

    if (response.status === "completed" && response.output_text) {
      return {
        status: "completed",
        final_message: response.output_text || "[Unknown] Something went wrong",
        context: context,
      };
    }

    if (response.status === "failed") {
      return {
        status: "error",
        final_message: `[Failed]  ${
          (response.output[0] as ResponseOutputMessage).content
        } ${response.error?.message}`,
        context: context,
      };
    }

    if (response.status === "incomplete") {
      return {
        status: "error",
        final_message: `[Incomplete]  ${
          (response.output[0] as ResponseOutputMessage).content
        } ${response.incomplete_details?.reason}`,
        context: context,
      };
    }

    const call_results: ResponseInputItem.FunctionCallOutput[] = [];
    if (response.output[0].type === "function_call") {
      const tool_calls: ResponseFunctionToolCall[] =
        response.output as ResponseFunctionToolCall[];
      if (tool_calls && tool_calls.length > 0) {
        for (const tool_call of tool_calls) {
          if (tool_call.name === "CallSubAgent") {
            const args = JSON.parse(tool_call.arguments);
            const sub_agent = this.config.sub_agents?.find(
              (agent) => agent.config.name === args.sub_agent
            );

            if (!sub_agent) {
              call_results.push({
                type: "function_call_output",
                call_id: tool_call.call_id,
                output:
                  `[Sub Agent Error] ${args.sub_agent} - Sub Agent not found` as string,
              });
              continue;
            }

            const result = await sub_agent.run_responses({
              context: [
                ...context,
                {
                  role: "user",
                  content: args.request,
                },
              ],
            });

            call_results.push({
              type: "function_call_output",
              call_id: tool_call.call_id,
              output: result.final_message,
            });
          } else {
            const tool = this.config.tools?.find(
              (tool) => tool.name === tool_call.name
            );

            if (!tool) {
              call_results.push({
                type: "function_call_output",
                call_id: tool_call.call_id,
                output: `[Tool Call Error] ${tool_call.name} - Tool not found`,
              });
              continue;
            }

            try {
              const result = await tool.callback(
                JSON.parse(tool_call.arguments)
              );
              call_results.push({
                type: "function_call_output",
                call_id: tool_call.call_id,
                output: valueToString(result),
              });
            } catch (error: Error | any) {
              call_results.push({
                type: "function_call_output",
                call_id: tool_call.call_id,
                output: `[Tool Call Error] ${tool_call.name} - ${error.message}`,
              });
            }
          }
        }
      }
    }

    return this.run_responses({
      context: [...context, ...response.output, ...call_results],
    });
  }

  async run(
    input: string | AgentRequest<ResponseInputItem | ChatCompletionMessageParam>
  ): Promise<{
    status: string;
    final_message: string;
    context: ChatCompletionMessageParam[] | ResponseInputItem[];
  }> {
    if (Loom.api === "responses") return this.run_responses(input as any);

    return this.run_completions(input as any) as any;
  }
}
