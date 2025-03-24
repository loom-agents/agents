import { Agent } from "../Agent";

async function main() {
  const researchAgent = new Agent({
    name: "Research Agent",
    purpose: "Find up-to-date information on topics",
    web_search: {
      enabled: true,
      config: {
        search_context_size: "medium",
        user_location: {
          country: "US",
        },
      },
    },
  });

  const result = await researchAgent.run("What is the capital of Wisconsin?");
  console.log(result);
}

main().catch(console.error);
