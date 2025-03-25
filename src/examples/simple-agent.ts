import { Agent, Runner } from "loom-agents";

async function main() {
  const greetingAgent = new Agent({
    name: "Greeting Agent",
    purpose: "Generate friendly greetings",
  });

  const runner = new Runner(greetingAgent);
  const result = await runner.run("Say hello to the user");

  console.log(result);
}

main().catch(console.error);
