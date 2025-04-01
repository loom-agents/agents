/*
Completions
[
    {
      "role": "system",
      "content": [
        {
          "type": "text",
          "text": "test"
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "test"
        }
      ]
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "text",
          "text": "How can I assist you today?"
        }
      ]
    }
  ],
  */

/*
  Responses
  [
    {
      "role": "system",
      "content": [
        {
          "type": "input_text",
          "text": "test"
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "test"
        }
      ]
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "How can I assist you today?"
        }
      ]
    }
  ]*/

type BridgeTextContent = { type: "text"; text: string };
type BridgeImageContent = { type: "image_url"; url: string };
type BridgeFileContent = { type: "file"; filename: string; file_data: string };

type BridgeMessage =
  | {
      role: "system" | "user" | "assistant";
      content: (BridgeTextContent | BridgeImageContent | BridgeFileContent)[];
    }
  | {
      type: "tool_call";
      call_id: string;
      name: string;
      arguments: string;
    }
  | {
      type: "tool_result";
      call_id: string;
      output: string;
    };

export class Bridge {
  constructor(public bridge: BridgeMessage[]) {}

  static from(input: any[]): Bridge {
    const bridge: BridgeMessage[] = [];
    const toolCallIds = new Set<string>();

    for (const msg of input) {
      if (msg.role && msg.content !== undefined) {
        const contentArray = Array.isArray(msg.content)
          ? msg.content
          : [{ type: "text", text: msg.content }];

        const content = contentArray
          .map((part: any) => {
            const type =
              part.type ??
              (msg.role === "assistant" ? "output_text" : "input_text");
            if (
              type === "text" ||
              type === "input_text" ||
              type === "output_text"
            )
              return { type: "text", text: part.text ?? part };
            if (type === "image_url" || type === "input_image")
              return {
                type: "image_url",
                url: part.image_url?.url || part.image_url,
              };
            if (type === "file" || type === "input_file")
              return {
                type: "file",
                filename: part.file?.filename ?? part.filename,
                file_data: part.file?.file_data ?? part.file_data,
              };
            return null;
          })
          .filter(Boolean);

        if (msg.role === "tool") {
          bridge.push({
            type: "tool_result",
            call_id: msg.tool_call_id,
            output: content[0]?.text ?? "",
          });
        } else {
          bridge.push({ role: msg.role, content });
        }
      } else if (msg.tool_calls) {
        for (const call of msg.tool_calls) {
          toolCallIds.add(call.id);
          bridge.push({
            type: "tool_call",
            call_id: call.id,
            name: call.function.name,
            arguments: call.function.arguments,
          });
        }
      } else if (msg.type === "function_call") {
        toolCallIds.add(msg.call_id);
        bridge.push({
          type: "tool_call",
          call_id: msg.call_id,
          name: msg.name,
          arguments: msg.arguments,
        });
      } else if (msg.type === "function_call_output") {
        if (!toolCallIds.has(msg.call_id)) continue; // Skip orphan tool results (Maybe we shouldn't do this, but for now we do)
        bridge.push({
          type: "tool_result",
          call_id: msg.call_id,
          output: msg.output,
        });
      }
    }

    return new Bridge(bridge);
  }

  toCompletions(): any[] {
    const completions: any[] = [];
    let pendingToolCall: any = null;

    for (const msg of this.bridge) {
      if ("role" in msg) {
        completions.push({
          role: msg.role,
          content: msg.content.map((c) => {
            if (c.type === "text") return { type: "text", text: c.text };
            if (c.type === "image_url")
              return { type: "image_url", image_url: { url: c.url } };
            if (c.type === "file")
              return {
                type: "file",
                file: { filename: c.filename, file_data: c.file_data },
              };
          }),
        });
      } else if (msg.type === "tool_call") {
        if (!pendingToolCall) {
          pendingToolCall = {
            role: "assistant",
            content: [],
            tool_calls: [],
          };
        }
        pendingToolCall.tool_calls.push({
          id: msg.call_id,
          type: "function",
          function: {
            name: msg.name,
            arguments: msg.arguments,
          },
        });
      } else if (msg.type === "tool_result") {
        if (pendingToolCall) {
          completions.push(pendingToolCall);
          pendingToolCall = null;
        }
        completions.push({
          role: "tool",
          tool_call_id: msg.call_id,
          content: [
            {
              type: "text",
              text: msg.output,
            },
          ],
        });
      }
    }

    if (pendingToolCall) {
      completions.push(pendingToolCall);
    }

    return completions;
  }

  toResponses(): any[] {
    const seenToolCalls = new Set(
      this.bridge
        .filter((m: any) => m.type === "tool_call")
        .map((m) => (m as any).call_id)
    );

    return this.bridge
      .map((msg) => {
        if ("role" in msg) {
          return {
            role: msg.role,
            content: msg.content.map((c) => {
              if (c.type === "text")
                return {
                  type: msg.role === "assistant" ? "output_text" : "input_text",
                  text: c.text,
                };
              if (c.type === "image_url")
                return { type: "input_image", image_url: c.url };
              if (c.type === "file")
                return {
                  type: "input_file",
                  filename: c.filename,
                  file_data: c.file_data,
                };
            }),
          };
        } else if (msg.type === "tool_call") {
          return {
            type: "function_call",
            call_id: msg.call_id,
            name: msg.name,
            arguments: msg.arguments,
          };
        } else if (msg.type === "tool_result") {
          if (!seenToolCalls.has(msg.call_id)) return null;
          return {
            type: "function_call_output",
            call_id: msg.call_id,
            output: msg.output,
          };
        }
      })
      .filter(Boolean);
  }
}
