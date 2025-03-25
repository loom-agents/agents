import { v4 as uuidv4 } from "uuid";

export interface TracingAction {
  id: string;
  action: string;
  parameters?: Record<string, any>;
  result: string | null;
  status: "pending" | "success" | "error" | "cancelled";
  performed_at: Date;
  resolved_at: Date | null;
  parent_id?: string;
  children?: string[];
}

export interface TracingConfig {
  parent?: Tracing;
  context?: Record<string, any>;
}

export class Tracing {
  private log: TracingAction[] = [];
  private context: Record<string, any> = {};
  private parent?: Tracing;

  constructor(config: TracingConfig = {}) {
    this.parent = config.parent;
    this.context = config.context || {};
  }

  public StartAction(
    action: string,
    parameters: Record<string, any> = {},
    parent_id?: string
  ): string {
    const id = uuidv4();
    const newAction: TracingAction = {
      id,
      action,
      parameters: { ...parameters, context: this.context },
      result: null,
      status: "pending",
      performed_at: new Date(),
      resolved_at: null,
      parent_id,
    };

    if (parent_id) {
      const parentAction = this.log.find((a) => a.id === parent_id);
      if (parentAction) {
        parentAction.children = parentAction.children || [];
        parentAction.children.push(id);
      }
    }

    this.log.push(newAction);
    return id;
  }

  public FinishAction(
    id: string,
    result: string,
    status: "success" | "error" | "cancelled" = "success"
  ): void {
    const action = this.log.find((a) => a.id === id);
    if (!action) {
      throw new Error(`Action with ID ${id} not found`);
    }

    action.result = result;
    action.status = status;
    action.resolved_at = new Date();
  }

  public GetLog(): TracingAction[] {
    return [...this.log];
  }

  public LogRaw(message: string, parent_id?: string): string {
    const id = uuidv4();
    const newAction: TracingAction = {
      id,
      action: "log",
      result: message,
      status: "success",
      performed_at: new Date(),
      resolved_at: new Date(),
      parent_id,
    };

    if (parent_id) {
      const parentAction = this.log.find((a) => a.id === parent_id);
      if (parentAction) {
        parentAction.children = parentAction.children || [];
        parentAction.children.push(id);
      }
    }

    this.log.push(newAction);
    return id;
  }

  public LogAction(...actions: TracingAction[]): void {
    this.log.push(...actions);
  }

  public CreateChildTracing(context: Record<string, any> = {}): Tracing {
    return new Tracing({
      parent: this,
      context: {
        ...this.context,
        ...context,
      },
    });
  }

  public MergeChildTracing(
    childTracing: Tracing,
    parentActionId?: string
  ): void {
    const childLog = childTracing.GetLog();

    for (const action of childLog) {
      if (!action.parent_id && parentActionId) {
        action.parent_id = parentActionId;
        const parentAction = this.log.find((a) => a.id === parentActionId);
        if (parentAction) {
          parentAction.children = parentAction.children || [];
          parentAction.children.push(action.id);
        }
      }
    }

    this.log.push(...childLog);
  }

  public GetHierarchicalTrace(): Record<string, any> {
    const result: Record<string, any> = {};
    const topLevelActions = this.log.filter((a) => !a.parent_id);

    for (const action of topLevelActions) {
      result[action.id] = this.buildHierarchy(action.id);
    }

    return result;
  }

  private buildHierarchy(actionId: string): Record<string, any> {
    const action = this.log.find((a) => a.id === actionId);
    if (!action) {
      return {};
    }

    const result: Record<string, any> = {
      action: action.action,
      parameters: action.parameters,
      result: action.result,
      status: action.status,
      performed_at: action.performed_at,
      resolved_at: action.resolved_at,
    };

    if (action.children && action.children.length > 0) {
      result.children = {};
      for (const childId of action.children) {
        result.children[childId] = this.buildHierarchy(childId);
      }
    }

    return result;
  }

  public ToString(hierarchical: boolean = false): string {
    return JSON.stringify(
      hierarchical ? this.GetHierarchicalTrace() : this.log,
      null,
      2
    );
  }

  public ExportForVisualization(): Record<string, any> {
    return {
      trace: this.GetHierarchicalTrace(),
      meta: {
        total_actions: this.log.length,
        start_time: this.log.length > 0 ? this.log[0].performed_at : null,
        end_time:
          this.log.length > 0
            ? this.log[this.log.length - 1].resolved_at
            : null,
      },
    };
  }
}
