import { Agent } from "../Agent";

async function main() {
  // Create specialized tutor agents
  const MathTutorAgent = new Agent({
    name: "Math Tutor",
    purpose:
      "You provide help with math problems. Explain your reasoning at each step and include examples",
  });

  const HistoryTutorAgent = new Agent({
    name: "History Tutor",
    purpose:
      "You provide assistance with historical queries. Explain important events and context clearly",
  });

  // Create the triage agent with sub-agents
  const TriageAgent = new Agent({
    name: "Triage Agent",
    purpose:
      "Determine which agent to use based on the user's homework question",
    sub_agents: [MathTutorAgent, HistoryTutorAgent],
  });

  // Test the implementation
  const result1 = await TriageAgent.run("What is 2 + 2?");
  console.log("Result 1:", result1);

  const result2 = await TriageAgent.run(
    "Who was the best president in american history?"
  );
  console.log("Result 2:", result2);
}

main().catch(console.error);
