import { Agent, Runner } from "loom-agents";

async function main() {
  const researchAgent = new Agent({
    name: "Research Agent",
    purpose: "Gather information on topics",
    web_search: {
      enabled: true,
    },
  });

  const writingAgent = new Agent({
    name: "Writing Agent",
    purpose: "Create well-structured content based on research",
  });

  const factCheckAgent = new Agent({
    name: "Fact Check Agent",
    purpose: "Verify factual accuracy of content",
    web_search: {
      enabled: true,
    },
  });

  // Create the content production system
  const deepResearchAgent = new Agent({
    name: "Content Creation Agent",
    purpose: "Produce high-quality, factually accurate articles.",
    sub_agents: [researchAgent, writingAgent, factCheckAgent],
  });

  const runner = new Runner(deepResearchAgent);
  const result = await runner.run(
    "Create an article about recent advances in renewable energy, include citations from the researcher. Fact check your work."
  );

  console.log(result);
}

main().catch(console.error);
