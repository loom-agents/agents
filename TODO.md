# TODO List

- [ ] Ensure that function call w/ output_text _is properly_ resolved, it seems like the fixes put in place after noticing this occuring resolved it, but it was already quite rare so need to make sure. I don't know if completions api can have multiple choices not bound to `n`, hard to test against this edge case. 
- [ ] Add mcp context support
    - [ ] MCP Prompts
    - [X] MCP Resources
    - [ ] Integrations debate, do MCP resources / prompts / other get pushed into the Agents general context or do developers just have exposure to integrate? 
- [ ] More involved agent examples
- [ ] Add Agent output_type to support structured schema output
- [ ] Find bugs
- [ ] If a sub agent type mismatches a parent agent type the context fed in needs to be normalized or it is misaligned and bad things happen
- [ ] UUID _everything_
- [ ] normalize trace names, most likely `${Class}.${Function}` 
- [ ] Debugging
- [X] Normalize Agent tool use, refactor down to a simpler _dry_er wrapper. 
- [X] Validate sub agent flow is proper, maybe sub agents need more context. (maybe we have a flow where agents decide what of their output / task was valid or useful context, kind of sounds like something a dev would decide on instead of loom itself? thinking. ) (Marking complete w/ addition of `examples/debate-orchestration.ts / debate.json sample`)
- [X] Per agent configs (ability to use claude for example for HTML Coding agents while using o3 for reasoning or deepseek for cheaper general agents) 
- [X] Add mcp tool support
- [X] Improved llms helper
- [X] Fix runners crashing with subsequent runs. (Allow more than 1 tracer or mutliple runner traces (each run its own trace))
- [X] Docs website
- [X] Refactor / implement a tracing system
- [X] Add completions API support (enables nearly any model/api router support)

# OpenAI Bugs

> Implications, when crossing ChatCompletions and Responses Agents, even with the Bridge, working fully, you may run into issues simply because the Completions API has a bug in it. However it should be noted Agents cannot use _file uploads_ at the moment anyways (time of writing) 

This bug could be fixed in the future but when reported to OpenAI they said to just use the Responses API. 

If a file is before tool calls the Completions API will say there's a misalignment of tools / tool responses.
Responses handles it properly
`Invalid parameter: messages with role 'tool' must be a response to a preceeding message with 'tool_calls'.`
In my testing it was specifically the "pdf file" (any file) after system, removal allows execution properly.

```completions.js
import OpenAI from "openai";
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: "get weather",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "file",
          file: {
            file_data: "data:application/pdf;base64,dGVzdGluZwo=",
            filename: "test.pdf",
          },
        },
      ],
    },
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "nice",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: "data:image/png;base64,...",
          },
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "weather mke",
        },
      ],
    },
    {
      role: "assistant",
      content: [],
      tool_calls: [
        {
          id: "call_oHSx037fMoZS0JabPJshFvid",
          type: "function",
          function: {
            name: "get_weather",
            arguments: '{"location":"Milwaukee, WI","unit":"f"}',
          },
        },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "text",
          text: "40f",
        },
      ],
      tool_call_id: "call_oHSx037fMoZS0JabPJshFvid",
    },
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "The current temperature in Milwaukee, WI is 40°F.",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "thanks",
        },
      ],
    },
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "You're welcome! If you need anything else, feel free to ask.",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "i will :)",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "ty",
        },
      ],
    },
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "You're welcome! 😊",
        },
      ],
    },
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "You're welcome! 😊",
        },
      ],
    },
  ],
  response_format: {
    type: "text",
  },
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Determine weather in my location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city and state e.g. San Francisco, CA",
            },
            unit: {
              type: "string",
              enum: ["c", "f"],
            },
          },
          additionalProperties: false,
          required: ["location", "unit"],
        },
        strict: true,
      },
    },
  ],
  temperature: 1,
  max_completion_tokens: 2048,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  store: false,
});
```
```responses.js
import OpenAI from "openai";
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const response = await openai.responses.create({
  model: "gpt-4o",
  input: [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: "get weather",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_file",
          filename: "test.pdf",
          file_data: "data:application/pdf;base64,dGVzdGluZwo=",
        },
      ],
    },
    {
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "nice",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_image",
          image_url: "data:image/png;base64,...",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "weather mke",
        },
      ],
    },
    {
      type: "function_call",
      call_id: "call_oHSx037fMoZS0JabPJshFvid",
      name: "get_weather",
      arguments: '{"location":"Milwaukee, WI","unit":"f"}',
    },
    {
      type: "function_call_output",
      call_id: "call_oHSx037fMoZS0JabPJshFvid",
      output: "40f",
    },
    {
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "The current temperature in Milwaukee, WI is 40°F.",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "thanks",
        },
      ],
    },
    {
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "You're welcome! If you need anything else, feel free to ask.",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "i will :)",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "ty",
        },
      ],
    },
    {
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "You're welcome! 😊",
        },
      ],
    },
    {
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "You're welcome! 😊",
        },
      ],
    },
    {
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "You're welcome! 😊",
        },
      ],
    },
  ],
  text: {
    format: {
      type: "text",
    },
  },
  reasoning: {},
  tools: [
    {
      type: "function",
      name: "get_weather",
      description: "Determine weather in my location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state e.g. San Francisco, CA",
          },
          unit: {
            type: "string",
            enum: ["c", "f"],
          },
        },
        additionalProperties: false,
        required: ["location", "unit"],
      },
      strict: true,
    },
  ],
  temperature: 1,
  max_output_tokens: 2048,
  top_p: 1,
  store: true,
});
```
