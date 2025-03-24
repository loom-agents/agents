import { v4 as uuidv4 } from "uuid";

export interface TracingAction {
  id: string;
  action: string;

  parameters?: Record<string, any>;
  result: string | null;

  status: string;
  performed_at: Date;
  resolved_at: Date;
}

export interface TracingConfig {}

export class Tracing {
  private log: TracingAction[] = [];
  constructor({}: TracingConfig) {}

  public StartAction(action: string, parameters: Record<string, any>): string {
    const id = uuidv4();
    this.log.push({
      id,
      action,
      result: null,
      parameters,
      status: "pending",
      performed_at: new Date(),
      resolved_at: new Date(),
    });
    return id;
  }

  public FinishAction(id: string, result: string, status: string): void {
    const action = this.log.find((a) => a.id === id);
    if (!action) {
      throw new Error("Action not found");
    }
    action.result = result;
    action.status = status;
    action.resolved_at = new Date();
  }

  public GetLog(): TracingAction[] {
    return this.log;
  }

  public LogRaw(message: string): void {
    this.log.push({
      id: uuidv4(),
      action: "log",
      result: message,
      status: "success",
      performed_at: new Date(),
      resolved_at: new Date(),
    });
  }

  public LogAction(...actions: TracingAction[]): void {
    this.log.push(...actions);
  }

  public ToString(): string {
    return JSON.stringify(this.log);
  }
}
