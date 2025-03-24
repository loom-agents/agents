import { Agent } from "../Agent";

async function main() {
  // Create a simple agent
  const greetingAgent = new Agent({
    name: "Greeting Agent",
    purpose: "Generate friendly greetings",
  });

  // Run the agent with a request
  const result = await greetingAgent.run("Say hello to the user");
  console.log(result);
}

main().catch(console.error);
