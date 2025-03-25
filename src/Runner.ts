import { ResponseInputItem } from "openai/resources/responses/responses";
import { Agent, AgentResponse } from "./Agent";
import { Tracing } from "./Tracing";
import { v4 as uuidv4 } from "uuid";

export interface RunnerConfig {
  max_depth?: number;
  name?: string;
  id?: string;
  context?: Record<string, any>;
}

export class Runner {
  private trace: Tracing;
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

    this.trace = new Tracing({
      context: {
        runner_id: this.config.id,
        runner_name: this.config.name,
        ...this.config.context,
      },
    });

    this.agent = agent;
  }

  async run(input: string | ResponseInputItem[]): Promise<any> {
    let depth = 0;
    const maxMaxDepth = this.config.max_depth || 10;

    let result: AgentResponse = await this.agent.run(input);

    do {
      depth += 1;
      if (result.toStatus() === "completed") {
        return result;
      }

      result = await this.agent.run(result.toInputList());
    } while (depth < maxMaxDepth && result.toStatus() !== "completed");

    return result;
  }

  public GetMessages(): ResponseInputItem[] {
    return this.messages;
  }

  public GetTrace(): Tracing {
    return this.trace;
  }

  public GetHierarchicalTrace(): Record<string, any> {
    return this.trace.GetHierarchicalTrace();
  }

  public ExportTrace(): Record<string, any> {
    return this.trace.ExportForVisualization();
  }
}
