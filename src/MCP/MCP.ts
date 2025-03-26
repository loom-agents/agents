import {
  SSEClientTransportOptions,
  SSEClientTransport,
} from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolRequest } from "@modelcontextprotocol/sdk/types";

export abstract class MCPServerBase {
  protected transport: SSEClientTransport | StdioClientTransport;
  protected client: Client | undefined;
  protected tools: any;

  constructor(transport: SSEClientTransport | StdioClientTransport) {
    this.transport = transport;
  }

  async getTools() {
    if (this.tools) {
      return this.tools;
    }

    if (!this.client) {
      this.client = new Client({
        name: "loom-agents",
        version: process.env.npm_package_version || "<unknown>",
      });

      await this.client.connect(this.transport);
    }

    this.tools = await this.client.listTools();
    return this.tools;
  }

  async callTool(params: CallToolRequest["params"]) {
    if (!this.client) {
      throw new Error("Client is not connected");
    }

    return this.client.callTool(params);
  }
}

export class MCPServerSSE extends MCPServerBase {
  constructor(url: URL, opts?: SSEClientTransportOptions) {
    const transport = new SSEClientTransport(url, opts);
    super(transport);
  }
}

export class MCPServerStdio extends MCPServerBase {
  constructor(command: string, args: string[]) {
    const transport = new StdioClientTransport({ command, args });
    super(transport);
  }
}
