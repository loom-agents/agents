import { Agent, AgentRequest, AgentResponse } from "../Agent/Agent.js";
import { TraceSession } from "../TraceSession/TraceSession.js";
import { uuid } from "../Utils/Utils.js";

export interface RunnerConfig {
  maxDepth?: number;
  name?: string;
  id?: string;
  context?: Record<string, any>;
}

export interface RunnerResponse<T> extends AgentResponse<T> {
  traceTree: any;
}

export class Runner {
  private config: RunnerConfig;
  private agent: Agent;
  private traceSession: TraceSession;

  constructor(agent: Agent, config: RunnerConfig = {}) {
    if (!agent) {
      throw new Error("Agent is required");
    }
    this.config = {
      name: config.name || "Runner",
      id: config.id || "",
      maxDepth: config.maxDepth || 10,
      context: config.context || {},
    };
    this.agent = agent;
    // Create a new TraceSession for this run.
    this.traceSession = new TraceSession("runner.session", {
      agent: uuid("Runner Session"),
      config: this.config,
    });
  }

  /**
   * Runs the agent through potentially multiple turns,
   * ensuring each turn is traced and ultimately returning the full trace tree.
   */
  public async run(
    input: string | AgentRequest<any>
  ): Promise<RunnerResponse<any>> {
    // Start a top-level trace for the run.
    this.traceSession.start("runner.run", { input });

    let depth = 0;
    let result = await this.agent.run(input, this.traceSession);

    // For multi-turn interactions, wrap each turn in its own trace.
    while (
      depth < (this.config.maxDepth || 10) &&
      result.status !== "completed"
    ) {
      depth++;
      this.traceSession.start(`turn-${depth}`, {});
      result = await this.agent.run(
        { context: result.context },
        this.traceSession
      );
      this.traceSession.end(); // End current turn trace.
    }

    // End the top-level run trace.
    this.traceSession.end();

    return { ...result, traceTree: this.traceSession.getTraceTree() };
  }

  /**
   * Renders the entire trace tree as a formatted string.
   */
  public renderTraces(): string {
    return this.traceSession.render();
  }
}
