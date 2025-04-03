import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionContentPart,
  ChatCompletionContentPartImage,
  ChatCompletionContentPartText,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat";
import {
  FunctionTool,
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputMessage,
  Tool as OAITool,
  ResponseInputImage,
  ResponseInputFile,
  ResponseInputText,
  ResponseFunctionWebSearch,
  ResponseOutputText,
} from "openai/resources/responses/responses";
import { Loom } from "../Loom/Loom.js";
import { MCPServerSSE, MCPServerStdio } from "../MCP/MCP.js";
import OpenAI, { ClientOptions } from "openai";
import { TraceNode, TraceSession } from "../TraceSession/TraceSession.js";
import { object, SchemaFragment } from "loom-schema";
import { uuid } from "../Utils/Utils.js";

export interface Tool {
  name: string;
  parameters: SchemaFragment<any> | Record<string, any>;
  description: string;
  callback: (...args: any[]) => any;
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

export interface OutputType {
  type: "text" | "json_object" | "json_schema";
  name?: string;
  schema?: SchemaFragment<any> | Record<string, any>;
}

export interface AgentConfig {
  name: string;
  purpose: string;
  sub_agents?: Agent[];
  tools?: Tool[];
  mcp_servers?: (MCPServerSSE | MCPServerStdio)[];
  model?: string;
  web_search?: WebSearchConfig;
  timeout_ms?: number;

  output_type?: OutputType;

  client_config?: ClientOptions;
  request_options?:
    | OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
    | OpenAI.Responses.ResponseCreateParamsNonStreaming;

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

const normalizeToRegex = (content: string, regexp: string) => {
  const regex = new RegExp(regexp, "g");
  return content.replace(regex, "_");
};

export interface AgentRequest<T> {
  context: T[];
}

export interface AgentResponse<T> {
  status: string;
  final_message: string;
  context: T[];
}

class RequestToolCall {
  static fromResponses(tool_call: ResponseFunctionToolCall) {
    return new RequestToolCall(tool_call.name, JSON.parse(tool_call.arguments));
  }

  static fromCompletions(tool_call: ChatCompletionMessageToolCall) {
    return new RequestToolCall(
      tool_call.function.name,
      JSON.parse(tool_call.function.arguments)
    );
  }

  public name: string;
  public arguments: object;

  constructor(name: string, args: object) {
    this.name = name;
    this.arguments = args;
  }

  get isMCP() {
    return this.name.startsWith("mcp_");
  }

  get isSubAgent() {
    return this.name === "CallSubAgent";
  }

  get isTool() {
    return !this.isMCP && !this.isSubAgent;
  }

  get traceName() {
    if (this.isMCP) return "mcp_tool_call";
    if (this.isSubAgent) return "call_sub_agent";
    return "tool_call";
  }
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

    this.uuid = uuid("Agent");

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

  private tool_box: Record<string, any> = {};
  private prepared_tools: OAITool[] | undefined = undefined;

  private async prepareTools(): Promise<OAITool[]> {
    if (this.prepared_tools) return this.prepared_tools;
    this.prepared_tools = [];

    if (this.config.mcp_servers) {
      for (const mcp of this.config.mcp_servers) {
        const server_tools = await mcp.getTools();
        for (const tool of server_tools.tools) {
          this.prepared_tools.push({
            type: "function" as const,
            name: tool.name,
            description: tool.description ?? `MCP Tool: ${tool.name}`,
            parameters: {
              type: "object",
              properties: tool.inputSchema.properties,
              required: tool.inputSchema.required,
              additionalProperties: false,
            },
            strict: true,
          });
          if (this.tool_box[tool.name]) {
            throw new Error(
              `Tool name conflict: ${tool.name}. Agent already has a tool with this name.`
            );
          } else {
            this.tool_box[tool.name] = async (args: any) => {
              const result = await mcp.callTool({
                name: tool.name,
                arguments: args,
              });
              if (result.isError) {
                throw new Error(
                  `[MCP Tool Call Error] ${tool.name} - ${valueToString(
                    result.content
                  )}`
                );
              }
              return result.content;
            };
          }
        }
      }
    }

    if (this.config.tools && this.config.tools.length > 0) {
      this.prepared_tools.push(
        ...this.config.tools.map((tool) => {
          const tool_name: string = normalizeToRegex(
            tool.name,
            "^[a-zA-Z0-9_-]+$"
          );
          const tool_call = {
            type: "function" as const,
            name: tool_name,
            description: tool.description,
            parameters:
              typeof tool.parameters?.toSchema === "function"
                ? tool.parameters.toSchema()
                : {
                    type: "object",
                    properties: tool.parameters ?? {},
                    required: tool.parameters
                      ? Object.keys(tool.parameters)
                      : [],
                    additionalProperties: false,
                  },
            strict: true,
          };
          if (this.tool_box[tool_name]) {
            throw new Error(
              `Tool name conflict: ${tool_name}. Agent already has a tool with this name.`
            );
          }
          this.tool_box[tool_name] = tool.callback;
          return tool_call;
        })
      );
    }

    if (this.config.sub_agents && this.config.sub_agents.length > 0) {
      // Is it better to have agents as an enum or to be an actual `function` definition? TODO: Learn.
      this.prepared_tools.push({
        type: "function" as const,
        name: "CallSubAgent",
        description:
          "Call a SubAgent with a given request. The sub agent will be called with the request and the context.",
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
      if (this.tool_box["CallSubAgent"]) {
        throw new Error(
          `Tool name conflict: CallSubAgent. Agent already has a tool with this name.`
        );
      }
      this.tool_box["CallSubAgent"] = async (args: {
        sub_agent: string;
        request: string;
        trace?: TraceSession;
        context?: any[];
      }) => {
        const sub_agent = this.config?.sub_agents?.find(
          (agent) => agent.config.name === args.sub_agent
        );
        if (!sub_agent) {
          throw new Error(
            `[Sub Agent Error] ${args.sub_agent} - Sub Agent not found`
          );
        }

        const input = args.context
          ? {
              context: [
                ...args.context,
                {
                  role: "user",
                  content: args.request,
                },
              ],
            }
          : args.request;

        const result = await sub_agent.run(input, args.trace);
        return result.final_message;
      };
    }

    if (this.config.web_search?.enabled && this._api !== "completions") {
      this.prepared_tools.push({
        type: "web_search_preview" as const,
        ...this.config.web_search.config,
      });
    }

    return this.prepared_tools;
  }

  private ToolsToCompletionTools(
    tools: OAITool[]
  ): ChatCompletionTool[] | undefined {
    if (!tools || tools.length === 0) return undefined;

    const toolsArray: ChatCompletionTool[] = [];
    toolsArray.push(
      ...tools
        .filter((tool: OAITool) => tool.type === "function")
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
    trace?.start("run_completions", {
      uuid: uuid("Agent Completions Run"),
    });

    const context: ChatCompletionMessageParam[] =
      typeof input === "string"
        ? [{ content: input, role: "user" }]
        : input.context;

    const web_search_config = this.config.web_search?.enabled
      ? this.config.web_search.config ?? {}
      : undefined;

    const user_location =
      web_search_config?.user_location?.type === "approximate"
        ? {
            type: "approximate" as const,
            approximate: {
              ...(web_search_config.user_location.city && {
                city: web_search_config.user_location.city,
              }),
              ...(web_search_config.user_location.country && {
                country: web_search_config.user_location.country,
              }),
              ...(web_search_config.user_location.region && {
                region: web_search_config.user_location.region,
              }),
            },
          }
        : undefined;

    const web_search_options = this.config.web_search?.enabled
      ? {
          ...(web_search_config?.search_context_size && {
            search_context_size: web_search_config.search_context_size,
          }),
          ...(user_location && { user_location }),
        }
      : undefined;

    const final_web_search_options = this.config.web_search?.enabled
      ? web_search_options ?? {}
      : undefined;

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
          content:
            `You are an AI Agent, your purpose is to (${
              this.config.purpose
            }). ${
              this.config.sub_agents && this.config.sub_agents.length > 0
                ? `You can query the following 'sub_agents' with the 'CallSubAgent' tool: {${this.config.sub_agents
                    .map((agent) => `${agent.config.name}`)
                    .join(", ")}}`
                : ""
            } Consider using all the tools available to you to achieve this. Start acting immediately.` +
            (this.config.output_type?.type === "json_object"
              ? `
          Please respond in this json format: ${JSON.stringify(
            this.config.output_type?.schema?.toSchema()
          )}`
              : ""),
        },
        ...context,
      ] as ChatCompletionMessageParam[],
      tools: this.ToolsToCompletionTools(await this.prepareTools()),
      web_search_options: final_web_search_options,
      response_format: {
        type: this.config?.output_type?.type || "text",
        ...(this.config.output_type?.type === "json_schema" && {
          json_schema: {
            ...(this.config.output_type.name && {
              name: this.config.output_type?.name,
            }),
            schema: this.config.output_type?.schema?.toSchema(),
            strict: true,
          },
        }),
      },

      ...((this.config.request_options as any) ?? {}),
    });

    const hasToolCalls = response.choices.some(
      (item) =>
        item.finish_reason === "function_call" ||
        item.finish_reason === "tool_calls"
    );

    if (response.choices[0].finish_reason === "stop" && !hasToolCalls) {
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
          const requestToolCall = RequestToolCall.fromCompletions(tool_call);
          const tool = this.tool_box[requestToolCall.name];
          if (!tool) {
            call_results.push({
              role: "tool" as const,
              tool_call_id: tool_call.id,
              content: `[Tool Call Error] ${requestToolCall.name} - Tool not found`,
            });
            continue;
          }
          trace?.start(requestToolCall.traceName, {
            tool_call,
            uuid: uuid("Agent Tool Call"),
          });

          try {
            if (requestToolCall.isSubAgent) {
              const result = await tool({
                ...requestToolCall.arguments,
                trace,
                context,
              });
              call_results.push({
                role: "tool" as const,
                tool_call_id: tool_call.id,
                content: result,
              });
              continue;
            }

            const result = await tool(requestToolCall.arguments);
            call_results.push({
              role: "tool" as const,
              tool_call_id: tool_call.id,
              content: valueToString(result),
            });
          } catch (error: Error | any) {
            call_results.push({
              role: "tool" as const,
              tool_call_id: tool_call.id,
              content: `[Tool Call Error] ${requestToolCall.name} - ${error.message}`,
            });
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
    trace?.start("run_responses", {
      uuid: uuid("Agent Responses Run"),
    });

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
          content:
            `You are an AI Agent, your purpose is to (${
              this.config.purpose
            }). ${
              this.config.sub_agents && this.config.sub_agents.length > 0
                ? `You can query the following 'sub_agents' with the 'CallSubAgent' tool: {${this.config.sub_agents
                    .map((agent) => `${agent.config.name}`)
                    .join(", ")}}`
                : ""
            } Consider using all the tools available to you to achieve this. Start acting immediately.` +
            (this.config.output_type?.type === "json_object"
              ? `
          Please respond in this json format: ${JSON.stringify(
            this.config.output_type?.schema?.toSchema()
          )}`
              : ""),
        },
        ...context,
      ] as ResponseInputItem[],
      tools: await this.prepareTools(),
      text: {
        format: {
          type: this.config.output_type?.type || "text",
          ...(this.config.output_type?.type === "json_schema" &&
            this.config?.output_type?.name && {
              name: this.config?.output_type?.name,
            }),
          ...(this.config.output_type?.type === "json_schema" && {
            schema: this.config?.output_type?.schema?.toSchema(),
            strict: true,
          }),
        },
      },
      ...((this.config.request_options as any) ?? {}),
    });

    const hasToolCalls = response.output.some(
      (item) => item.type === "function_call"
    );

    if (
      response.status === "completed" &&
      response.output_text &&
      !hasToolCalls
    ) {
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
    if (hasToolCalls) {
      const tool_calls: ResponseFunctionToolCall[] =
        response.output as ResponseFunctionToolCall[];
      if (tool_calls && tool_calls.length > 0) {
        for (const tool_call of tool_calls) {
          const requestToolCall = RequestToolCall.fromResponses(tool_call);
          const tool = this.tool_box[requestToolCall.name];
          if (!tool) {
            call_results.push({
              type: "function_call_output" as const,
              call_id: tool_call.call_id,
              output: `[Tool Call Error] ${requestToolCall.name} - Tool not found`,
            });
            continue;
          }

          trace?.start(requestToolCall.traceName, {
            tool_call,
            uuid: uuid("Agent Tool Call"),
          });

          try {
            if (requestToolCall.isSubAgent) {
              const result = await tool({
                ...requestToolCall.arguments,
                trace,
                context: context,
              });
              call_results.push({
                type: "function_call_output" as const,
                call_id: tool_call.call_id,
                output: result,
              });
              continue;
            }

            const result = await tool(requestToolCall.arguments);
            call_results.push({
              type: "function_call_output" as const,
              call_id: tool_call.call_id,
              output: valueToString(result),
            });
          } catch (error: Error | any) {
            call_results.push({
              type: "function_call_output" as const,
              call_id: tool_call.call_id,
              output: `[Tool Call Error] ${requestToolCall.name} - ${error.message}`,
            });
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

  public asTool(parameters?: object): Tool {
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
