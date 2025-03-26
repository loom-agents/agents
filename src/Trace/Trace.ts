import { v4 } from "uuid";

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
  private parent?: Trace;

  constructor(name: string, data: any, parent?: Trace) {
    this.details = {
      name,
      uuid: `trace.${v4()}`,
      data,
      startTime: Date.now(),
      children: [],
    };
    this.parent = parent;
  }

  public start(name: string, data: any): Trace {
    const subTrace = new Trace(name, data, this);
    this.details.children.push(subTrace.getDetails());
    return subTrace;
  }

  public end(): number {
    this.details.endTime = Date.now();
    return this.details.endTime - this.details.startTime;
  }

  public getDetails(): TraceDetails {
    return this.details;
  }
}

function renderTrace(
  details: TraceDetails,
  indent: string = "",
  last: boolean = true
): string {
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

  details.children.forEach((child, index) => {
    const childIsLast = index === details.children.length - 1;
    output += renderTrace(child, newIndent, childIsLast);
  });

  return output;
}

export class Tracer {
  private uuid: string;
  private trace?: Trace;
  constructor() {
    this.uuid = `tracer.${v4()}`;
  }
  public start(name: string, data: any): Trace {
    if (this.trace) {
      throw new Error("Trace already started");
    }
    this.trace = new Trace(name, data);
    return this.trace;
  }

  public getTrace(): Trace {
    if (!this.trace) {
      throw new Error("Trace not started");
    }
    return this.trace;
  }

  public render(): string {
    return renderTrace(this.getTrace().getDetails());
  }
}
