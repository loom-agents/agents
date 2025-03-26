import { ResponseInputItem } from "openai/resources/responses/responses";
import { Agent, AgentRequest, AgentResponse } from "../Agents/Agent";
import { Trace } from "../Trace/Trace";
import { v4 as uuidv4 } from "uuid";
import { ChatCompletionMessageParam } from "openai/resources/chat";

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
  private traces: Trace[] = [];
  private config: RunnerConfig;
  private agent: Agent;

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
  ): Promise<RunnerResponse<ResponseInputItem | ChatCompletionMessageParam>> {
    const agent_trace = new Trace("run", {
      agent: this.agent.uuid,
    });

    this.traces.push(agent_trace);

    let depth = 0;
    const maxMaxDepth = this.config.max_depth || 10;

    let result: AgentResponse<ResponseInputItem | ChatCompletionMessageParam> =
      await this.agent.run(input, agent_trace);
    do {
      depth += 1;
      if (result.status === "completed") {
        agent_trace.end();
        return { ...result, trace: agent_trace };
      }

      result = await this.agent.run(
        {
          context: result.context,
        },
        agent_trace
      );
    } while (depth < maxMaxDepth && result.status !== "completed");

    agent_trace.end();
    return { ...result, trace: agent_trace };
  }

  public getLastTrace(): Trace {
    return this.traces[this.traces.length - 1];
  }

  public getTraces(): Trace[] {
    return this.traces;
  }
}
