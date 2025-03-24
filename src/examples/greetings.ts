import { Agent } from "../Agent";

async function main() {
  const GreetingAgent = new Agent({
    name: "Greeting Agent",
    purpose: "Generate a greeting",
    sub_agents: [
      new Agent({
        name: "Translation Agent",
        purpose: "Translate the text to a different language",
      }),
    ],
  });

  const a = await GreetingAgent.run("Say hello in Spanish");
  console.log(a);

  const dayPlannerAgent = new Agent({
    name: "Day Planner Agent",
    purpose: "Generate a plan for the day",
    web_search: { enabled: true },
  });

  const c = await dayPlannerAgent.run("What should I do today in milwaukee??");
  console.log(c);

  const FarewellAgent = new Agent({
    name: "Farewell Agent",
    purpose: "Generate a farewell",
    sub_agents: [
      new Agent({
        name: "TimeAgent",
        purpose: "Get the current time",
        tools: [
          {
            name: "GetTime",
            description: "Get the current time",
            parameters: {},
            callback: () => new Date().toLocaleTimeString(),
          },
        ],
      }),
    ],
  });

  const b = await FarewellAgent.run("Say goodbye with the current time");
  console.log(b);
}

main().catch(console.error);
