import { Agent } from "../Agent";

async function main() {
  // Create specialized agents
  const mathTutor = new Agent({
    name: "Math Tutor",
    purpose: "Provide step-by-step math problem solutions",
  });

  const historyTutor = new Agent({
    name: "History Tutor",
    purpose: "Explain historical events with proper context",
  });

  // Create a parent agent that delegates to specialized agents
  const educationAgent = new Agent({
    name: "Education Agent",
    purpose: "Direct education questions to the appropriate specialist",
    sub_agents: [mathTutor, historyTutor],
  });

  // The parent agent will automatically route questions to the appropriate sub-agent
  const result = await educationAgent.run("What is the quadratic formula?");
}

main().catch(console.error);
