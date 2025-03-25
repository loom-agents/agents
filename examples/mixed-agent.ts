import { Agent, Runner, ToolCall } from "loom-agents";

async function main() {
  const translationAgent = new Agent({
    name: "Translation Agent",
    purpose:
      "I translate text into different languages, just let me know the language you want to translate to.",
  });

  const greetingAgent = new Agent({
    name: "Greeting Agent",
    purpose: "Generate a greeting",
    tools: [
      translationAgent.asTool({
        request: {
          type: "string",
          description: `The text to translate`,
        },
        language: {
          type: "string",
          description: `The language to translate to`,
        },
      }),
    ],
  });

  const runner = new Runner(greetingAgent);
  const result = await runner.run("Say hello to the user in spanish");
  console.log(result);
}

main().catch(console.error);
