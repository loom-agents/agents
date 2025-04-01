import { uuid } from "../Utils/Utils";

export interface TraceDetails {
  name: string;
  uuid: string;
  data: any;
  startTime: number;
  endTime?: number;
  children: TraceDetails[];
}

export class Trace {
  private details: TraceDetails;

  private children: Trace[] = [];
  private parent?: Trace;

  constructor(name: string, data: any, parent?: Trace) {
    this.details = {
      name,
      uuid: uuid("Trace"),
      data,
      startTime: Date.now(),
      children: [],
    };
    this.parent = parent;
  }

  public start(name: string, data: any): Trace {
    const subTrace = new Trace(name, data, this);
    this.children.push(subTrace);
    return subTrace;
  }

  public end(): number {
    this.details.endTime = Date.now();
    return this.details.endTime - this.details.startTime;
  }

  public getDetails(): TraceDetails {
    return {
      ...this.details,
      children: this.children.map((child) => child.getDetails()),
    };
  }

  public render(indent: string = "", last: boolean = true): string {
    const details = this.getDetails();
    const connector = indent ? (last ? "└─ " : "├─ ") : "";
    let line = `${indent}${connector}[${details.uuid}] ${details.name}`;

    if (typeof details.endTime === "number") {
      const duration = details.endTime - details.startTime;
      line += ` (${duration} ms)`;
    }

    if (details.data) {
      line += ` - ${JSON.stringify(details.data)}`;
    }

    let output = line + "\n";
    const newIndent = indent + (last ? "    " : "│   ");

    this.children.forEach((child, index) => {
      const childIsLast = index === this.children.length - 1;
      output += child.render(newIndent, childIsLast);
    });

    return output;
  }
}
