import {
  SSEClientTransportOptions,
  SSEClientTransport,
} from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolRequest } from "@modelcontextprotocol/sdk/types";

export abstract class MCPServerBase {
  protected transport: SSEClientTransport | StdioClientTransport;
  protected _client: Client | undefined;
  protected tools: any;

  constructor(transport: SSEClientTransport | StdioClientTransport) {
    this.transport = transport;
  }

  async getTools() {
    if (this.tools) {
      return this.tools;
    }

    if (!this._client) {
      this._client = new Client({
        name: "loom-agents",
        version: process.env.npm_package_version || "<unknown>",
      });

      await this._client.connect(this.transport);
    }

    this.tools = await this._client.listTools();
    return this.tools;
  }

  async callTool(params: CallToolRequest["params"]) {
    if (!this._client) {
      this._client = new Client({
        name: "loom-agents",
        version: process.env.npm_package_version || "<unknown>",
      });

      await this._client.connect(this.transport);
    }

    return this._client.callTool(params);
  }

  async getResourceTemplates() {
    if (!this._client) {
      this._client = new Client({
        name: "loom-agents",
        version: process.env.npm_package_version || "<unknown>",
      });

      await this._client.connect(this.transport);
    }

    return this._client.listResourceTemplates();
  }

  async getResources() {
    if (!this._client) {
      this._client = new Client({
        name: "loom-agents",
        version: process.env.npm_package_version || "<unknown>",
      });

      await this._client.connect(this.transport);
    }

    return this._client.listResources();
  }

  async readResource(uri: string, params?: any) {
    if (!this._client) {
      this._client = new Client({
        name: "loom-agents",
        version: process.env.npm_package_version || "<unknown>",
      });

      await this._client.connect(this.transport);
    }

    return this._client.readResource({ uri }, params);
  }

  get client() {
    if (!this._client) {
      this._client = new Client({
        name: "loom-agents",
        version: process.env.npm_package_version || "<unknown>",
      });
    }
    return this._client;
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
