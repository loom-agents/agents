import { Agent, Runner } from "loom-agents";

async function main() {
  const researchAgent = new Agent({
    name: "Research Agent",
    purpose: "Find up-to-date information on topics",
    web_search: {
      enabled: true,
      config: {
        search_context_size: "medium",
        user_location: {
          type: "approximate",
          country: "US",
        },
      },
    },
  });

  const runner = new Runner(researchAgent);
  const result = await runner.run(
    "Find information on the best restaurants in New York City"
  );

  console.log(result);
}

main().catch(console.error);
