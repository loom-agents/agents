import { Agent, Runner, ToolCall } from "loom-agents";

async function main() {
  const timeAgent = new Agent({
    name: "TimeAgent",
    purpose: "Get the current time and handle time operations",
    tools: [
      {
        name: "GetTime",
        description: "Get the current time",
        parameters: {},
        callback: () => {
          const time = new Date().toLocaleTimeString();
          return {
            success: true,
            message: "Retrieved current time",
            data: time,
          };
        },
      },
    ],
  });

  const farewellAgent = new Agent({
    name: "Farewell Agent",
    purpose: "Generate a contextual farewell message",
    sub_agents: [timeAgent],
  });

  const runner = new Runner(farewellAgent);
  const result = await runner.run("Say goodbye with the current time");

  console.log(result);
}

main().catch(console.error);
