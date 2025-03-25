import { Agent, Runner } from "loom-agents";

async function main() {
  // Create specialized tutor agents
  const mathTutorAgent = new Agent({
    name: "Math Tutor",
    purpose:
      "You provide help with math problems. Explain your reasoning at each step and include examples",
  });

  const historyTutorAgent = new Agent({
    name: "History Tutor",
    purpose:
      "You provide assistance with historical queries. Explain important events and context clearly",
  });

  // Create the triage agent with sub-agents
  const triageAgent = new Agent({
    name: "Triage Agent",
    purpose:
      "Determine which agent to use based on the user's homework question",
    sub_agents: [mathTutorAgent, historyTutorAgent],
  });

  const runner = new Runner(triageAgent);

  // Test the implementation
  const result1 = await runner.run("What is 2 + 2?");
  console.log("Result 1:", result1);

  const result2 = await runner.run(
    "Who was the best president in American history?"
  );
  console.log("Result 2:", result2);
}

main().catch(console.error);
