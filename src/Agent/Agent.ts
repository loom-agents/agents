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
import { Loom } from "../Loom/Loom.js";
import { v4 } from "uuid";
import { MCPServerSSE, MCPServerStdio } from "../MCP/MCP.js";
import OpenAI, { ClientOptions } from "openai";
import { TraceNode, TraceSession } from "../TraceSession/TraceSession.js";

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
  mcp_servers?: (MCPServerSSE | MCPServerStdio)[];
  model?: string;
  web_search?: WebSearchConfig;
  timeout_ms?: number;
  client_config?: ClientOptions;
  api?: "completions" | "responses";
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

export interface AgentResponse<T> {
  status: string;
  final_message: string;
  context: T[];
}

export class Agent {
  public uuid: string;
  private config: AgentConfig;
  private defaultModel = "gpt-4o";
  private defaultTimeout = 60000;
  private _client: OpenAI | undefined;
  private _api: "completions" | "responses" | undefined;

  constructor(config: AgentConfig) {
    if (!config.purpose) throw new Error("Agent purpose is required");
    if (!config.name) throw new Error("Agent name is required");
    if (config.client_config) this._client = new OpenAI(config.client_config);
    if (config.api) this._api = config.api;

    this.uuid = `agent.${v4()}`;

    this.config = {
      ...config,
      model: config.model || this.defaultModel,
      timeout_ms: config.timeout_ms || this.defaultTimeout,
    };
  }

  private get client(): OpenAI {
    if (!this._client) return Loom.openai;
    return this._client as OpenAI;
  }

  private async prepareTools(): Promise<Tool[]> {
    const toolsArray = [];

    if (this.config.mcp_servers) {
      for (const mcp of this.config.mcp_servers) {
        const server_tools = await mcp.getTools();
        for (const tool of server_tools.tools) {
          toolsArray.push({
            type: "function" as const,
            name: `mcp_${tool.name}`,
            description: `MCP Tool: ${tool.name}`,
            parameters: {
              type: "object",
              properties: tool.inputSchema.properties,
              required: tool.inputSchema.required,
              additionalProperties: false,
            },
            strict: true,
          });
        }
      }
    }

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
    input: string | AgentRequest<ChatCompletionMessageParam>,
    trace?: TraceSession
  ): Promise<AgentResponse<ChatCompletionMessageParam>> {
    const run_trace: TraceNode | undefined = trace?.start(
      "run_completions",
      {}
    );

    const context: ChatCompletionMessageParam[] =
      typeof input === "string"
        ? [{ content: input, role: "user" }]
        : input.context;

    const response = await this.client.chat.completions.create({
      model: this.config.model as string,
      // metadata: {
      //   loom: "powered",
      //   agent: this.config.name,
      // },
      // store: true, // meta data isn't enabled unless you store responses, so.. TODO: Completion mode add `store` config variable
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
      tools: this.ToolsToCompletionTools(await this.prepareTools()),
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
        context: [
          ...context,
          ...response.choices.map((choice) => choice.message),
        ],
      };
    }

    if (response.choices[0].finish_reason === "content_filter") {
      return {
        status: "error",
        final_message:
          "[Content Filter] " + response.choices[0].message.content,
        context: [
          ...context,
          ...response.choices.map((choice) => choice.message),
        ],
      };
    }

    if (response.choices[0].finish_reason === "length") {
      return {
        status: "error",
        final_message: "[Length] " + response.choices[0].message.content,
        context: [
          ...context,
          ...response.choices.map((choice) => choice.message),
        ],
      };
    }

    if (response.choices[0].finish_reason === "function_call") {
      return {
        status: "error",
        final_message: "[Function Call] Not implemented",
        context: [
          ...context,
          ...response.choices.map((choice) => choice.message),
        ],
      };
    }

    const call_results: ChatCompletionToolMessageParam[] = [];
    if (response.choices[0].finish_reason === "tool_calls") {
      const tool_calls = response.choices[0].message.tool_calls;
      if (tool_calls && tool_calls.length > 0) {
        for (const tool_call of tool_calls) {
          if (tool_call.function.name.startsWith("mcp_")) {
            const mcp_tool_trace = trace?.start("mcp_tool_call", {
              tool_call,
            });

            const mcp_tool_name = tool_call.function.name.replace("mcp_", "");
            const mcpResult = await this.config.mcp_servers?.reduce(
              async (accPromise, server) => {
                const acc = await accPromise;
                if (acc.mcp && acc.tool) return acc;
                const { tools } = await server.getTools();
                const tool = tools.find(
                  (tool: any) => tool.name === mcp_tool_name
                );
                return tool ? { mcp: server, tool } : acc;
              },
              Promise.resolve({
                mcp: undefined as MCPServerSSE | MCPServerStdio | undefined,
                tool: undefined,
              })
            );
            const { mcp, tool } = mcpResult || {};
            if (!mcp || !tool) {
              call_results.push({
                role: "tool" as const,
                tool_call_id: tool_call.id,
                content: `[MCP Tool Call Error] ${mcp_tool_name} - Tool not found`,
              });
              continue;
            }

            try {
              const result = await mcp.callTool({
                name: mcp_tool_name,
                arguments: JSON.parse(tool_call.function.arguments),
              });
              if (result.isError) {
                call_results.push({
                  role: "tool" as const,
                  tool_call_id: tool_call.id,
                  content: `[MCP Tool Call Error] ${mcp_tool_name} - ${valueToString(
                    result.content
                  )}`,
                });
                continue;
              }
              call_results.push({
                role: "tool" as const,
                tool_call_id: tool_call.id,
                content: valueToString(result.content),
              });
            } catch (error: Error | any) {
              call_results.push({
                role: "tool" as const,
                tool_call_id: tool_call.id,
                content: `[MCP Tool Call Error] ${mcp_tool_name} - ${error.message}`,
              });
            } finally {
            }
          } else if (tool_call.function.name === "CallSubAgent") {
            const sub_agent_trace = trace?.start("call_sub_agent", {
              tool_call,
            });
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

            const result = await sub_agent.run(
              {
                context: [
                  ...context,
                  {
                    role: "user",
                    content: args.request,
                  },
                ],
              },
              trace
            );

            call_results.push({
              role: "tool" as const,
              tool_call_id: tool_call.id,
              content: result.final_message,
            });
          } else {
            const tool_call_trace = trace?.start("tool_call", {
              tool_call,
            });
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
            } finally {
            }
          }
        }
      }
    }

    return this.run_completions(
      {
        context: [
          ...context,
          ...response.choices.map((choice) => choice.message),
          ...call_results,
        ],
      },
      trace
    ).finally(() => {});
  }

  private async run_responses(
    input: string | AgentRequest<ResponseInputItem>,
    trace?: TraceSession
  ): Promise<AgentResponse<ResponseInputItem>> {
    const run_trace: TraceNode | undefined = trace?.start("run_responses", {});

    const context: ResponseInputItem[] =
      typeof input === "string"
        ? [{ content: input, role: "user" }]
        : input.context;

    const response = await this.client.responses.create({
      model: this.config.model as string,
      metadata: {
        loom: "powered",
        agent: this.config.name,
      },
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
      tools: await this.prepareTools(),
    });

    if (response.status === "completed" && response.output_text) {
      console.log(
        `we think we finished so?`,
        JSON.stringify(response, null, 2)
      );
      return {
        status: "completed",
        final_message: response.output_text || "[Unknown] Something went wrong",
        context: [...context, ...response.output],
      };
    }

    if (response.status === "failed") {
      return {
        status: "error",
        final_message: `[Failed]  ${
          (response.output[0] as ResponseOutputMessage).content
        } ${response.error?.message}`,
        context: [...context, ...response.output],
      };
    }

    if (response.status === "incomplete") {
      return {
        status: "error",
        final_message: `[Incomplete]  ${
          (response.output[0] as ResponseOutputMessage).content
        } ${response.incomplete_details?.reason}`,
        context: [...context, ...response.output],
      };
    }

    const call_results: ResponseInputItem.FunctionCallOutput[] = [];
    if (response.output[0].type === "function_call") {
      const tool_calls: ResponseFunctionToolCall[] =
        response.output as ResponseFunctionToolCall[];
      if (tool_calls && tool_calls.length > 0) {
        for (const tool_call of tool_calls) {
          if (tool_call.name.startsWith("mcp_")) {
            const mcp_tool_trace = trace?.start("mcp_tool_call", {
              tool_call,
            });

            const mcp_tool_name = tool_call.name.replace("mcp_", "");
            const mcpResult = await this.config.mcp_servers?.reduce(
              async (accPromise, server) => {
                const acc = await accPromise;
                if (acc.mcp && acc.tool) return acc;
                const { tools } = await server.getTools();
                const tool = tools.find(
                  (tool: any) => tool.name === mcp_tool_name
                );
                return tool ? { mcp: server, tool } : acc;
              },
              Promise.resolve({
                mcp: undefined as MCPServerSSE | MCPServerStdio | undefined,
                tool: undefined,
              })
            );
            const { mcp, tool } = mcpResult || {};
            if (!mcp || !tool) {
              call_results.push({
                type: "function_call_output" as const,
                call_id: tool_call.call_id,
                output: `[MCP Tool Call Error] ${mcp_tool_name} - Tool not found`,
              });
              continue;
            }

            try {
              const result = await mcp.callTool({
                name: mcp_tool_name,
                arguments: JSON.parse(tool_call.arguments),
              });
              if (result.isError) {
                call_results.push({
                  type: "function_call_output" as const,
                  call_id: tool_call.call_id,
                  output: `[MCP Tool Call Error] ${mcp_tool_name} - ${valueToString(
                    result.content
                  )}`,
                });
                continue;
              }
              call_results.push({
                type: "function_call_output" as const,
                call_id: tool_call.call_id,
                output: valueToString(result.content),
              });
            } catch (error: Error | any) {
              call_results.push({
                type: "function_call_output" as const,
                call_id: tool_call.call_id,
                output: `[MCP Tool Call Error] ${mcp_tool_name} - ${error.message}`,
              });
            } finally {
            }
          } else if (tool_call.name === "CallSubAgent") {
            const sub_agent_trace = trace?.start("call_sub_agent", {
              tool_call,
            });

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

            const result = await sub_agent.run_responses(
              {
                context: [
                  ...context,
                  {
                    role: "user",
                    content: args.request,
                  },
                ],
              },
              trace
            );

            call_results.push({
              type: "function_call_output",
              call_id: tool_call.call_id,
              output: result.final_message,
            });
          } else {
            const tool_call_trace = trace?.start("tool_call", {
              tool_call,
            });

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
            } finally {
            }
          }
        }
      }
    }

    return this.run_responses(
      {
        context: [...context, ...response.output, ...call_results],
      },
      trace
    ).finally(() => {});
  }

  public async run(
    input:
      | string
      | AgentRequest<ResponseInputItem | ChatCompletionMessageParam>,
    trace?: TraceSession
  ): Promise<AgentResponse<ResponseInputItem | ChatCompletionMessageParam>> {
    const content: any =
      typeof input === "string"
        ? [{ content: input, role: "user" }]
        : input.context;

    const api = this._api ? this._api : Loom.api;

    if (api === "responses")
      return this.run_responses({ context: content }, trace);

    return this.run_completions({ context: content }, trace) as any;
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
