import { Agent } from "../Agent";

async function main() {
  const timeAgent = new Agent({
    name: "TimeAgent",
    purpose: "Get the current time and handle time operations",
    tools: [
      {
        name: "GetTime",
        description: "Get the current time",
        parameters: {},
        callback: () => new Date().toLocaleTimeString(),
      },
    ],
  });

  // Use the time agent as a sub-agent in a farewell agent
  const farewellAgent = new Agent({
    name: "Farewell Agent",
    purpose: "Generate a contextual farewell message",
    sub_agents: [timeAgent],
  });

  // The farewell agent can now use the time agent to include time information
  const result = await farewellAgent.run("Say goodbye with the current time");
  console.log(result); // "Goodbye! It's currently 2:45:30 PM where you are. Have a great rest of your day!"
}

main().catch(console.error);
