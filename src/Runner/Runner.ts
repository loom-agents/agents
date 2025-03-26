import { ResponseInputItem } from "openai/resources/responses/responses";
import { Agent, AgentRequest } from "../Agents/Agent";
import { Tracer } from "../Trace/Trace";
import { v4 as uuidv4 } from "uuid";
import { ChatCompletionMessageParam } from "openai/resources/chat";

export interface RunnerConfig {
  max_depth?: number;
  name?: string;
  id?: string;
  context?: Record<string, any>;
}

export class Runner {
  private tracer: Tracer = new Tracer();
  private config: RunnerConfig;
  private agent: Agent;
  private messages: ResponseInputItem[] = [];

  constructor(agent: Agent, config: RunnerConfig = {}) {
    if (!agent) {
      throw new Error("Agent is required");
    }

    this.config = {
      name: config.name || "Runner",
      id: config.id || uuidv4(),
      max_depth: config.max_depth || 10,
      context: config.context || {},
    };

    this.agent = agent;
  }

  async run(
    input:
      | string
      | AgentRequest<ResponseInputItem>
      | AgentRequest<ChatCompletionMessageParam>
  ): Promise<any> {
    const agent_trace = this.tracer.start("run", {
      agent: this.agent.uuid,
    });

    let depth = 0;
    const maxMaxDepth = this.config.max_depth || 10;

    let result: {
      status: string;
      final_message: string;
      context: ChatCompletionMessageParam[] | ResponseInputItem[];
    } = await this.agent.run(input, agent_trace);

    do {
      depth += 1;
      if (result.status === "completed") {
        agent_trace.end();
        return result;
      }

      result = await this.agent.run({
        context: result.context,
        trace: agent_trace,
      });
    } while (depth < maxMaxDepth && result.status !== "completed");

    agent_trace.end();
    return result;
  }

  public GetMessages(): ResponseInputItem[] {
    return this.messages;
  }

  public GetTracer(): Tracer {
    return this.tracer;
  }
}
