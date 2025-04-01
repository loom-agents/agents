import { uuid } from "../Utils/Utils";

export interface TraceNode {
  id: string;
  name: string;
  data: any;
  startTime: number;
  endTime?: number;
  children: TraceNode[];
}

export class TraceSession {
  private root: TraceNode;
  private currentPath: TraceNode[];

  constructor(name: string, data: any = {}) {
    this.root = {
      id: uuid("TraceSession"),
      name,
      data,
      startTime: Date.now(),
      children: [],
    };
    this.currentPath = [this.root];
  }

  public start(name: string, data: any = {}): TraceNode {
    const newNode: TraceNode = {
      id: uuid("TraceNode"),
      name,
      data,
      startTime: Date.now(),
      children: [],
    };
    const current = this.currentPath[this.currentPath.length - 1];
    current.children.push(newNode);
    this.currentPath.push(newNode);
    return newNode;
  }

  public end(): number {
    const current = this.currentPath.pop();
    if (!current) {
      throw new Error("No active trace node to end");
    }
    current.endTime = Date.now();
    return current.endTime - current.startTime;
  }

  public getTraceTree(): TraceNode {
    return this.root;
  }

  public render(node: TraceNode = this.root, indent: string = ""): string {
    const duration = node.endTime
      ? ` (${node.endTime - node.startTime} ms)`
      : "";
    let output = `${indent}[${node.id}] ${node.name}${duration}`;
    if (node.data && Object.keys(node.data).length > 0) {
      output += ` - ${JSON.stringify(node.data)}`;
    }
    output += "\n";
    const newIndent = indent + "  ";
    for (const child of node.children) {
      output += this.render(child, newIndent);
    }
    return output;
  }
}
