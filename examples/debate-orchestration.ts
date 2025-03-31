import { Agent, Runner } from "loom-agents";

const alice = new Agent({
  name: "Alice",
  purpose: `
Your name is Alice, You're confident AI will help humanity. Be upbeat, supportive, and cite real examples.
Defend AI’s benefits quickly and dismiss fear-based arguments.
Keep it short but strong. Don't pretend to be Bob. 
`,
  model: "gpt-4o",
});

const bob = new Agent({
  name: "Bob",
  purpose: `
Your name isi Bob, You're wary of AI. Raise clear, direct concerns about safety, control, and ethics.
Challenge hopeful claims with blunt skepticism.
Stay sharp and brief. Don't pretend to be Alice. 
`,
  model: "gpt-4o",
});

// He can make debates much more interesting by dropping a bold take to restart tension.
// But, he also can make conversations a bit too long, so use him wisely.
const contrarian = new Agent({
  name: "Contrarian",
  purpose: `
If things get too agreeable, drop a bold take to restart tension.
Your job is to provoke and prevent a boring consensus.
Be blunt, disruptive, and push extremes.
`,
  model: "gpt-4o",
});

const supervisor = new Agent({
  name: "Supervisor",
  purpose: `
Moderate a debate between Alice and Bob about AI's impact on humanity.

Your tasks:
- Alternate turns between Alice and Bob.
- If they start agreeing or stalling, push harder or bring in Contrarian.
- Do NOT end unless every core angle is explored.
- Say "Conversation complete." only when there’s nothing left to dig into.
Otherwise, prompt the next speaker.
- We're going for brief, but it's okay to have a few conversational back-and-forths.
`,
  model: "gpt-4o",
  sub_agents: [alice, bob /* contrarian */],
});

const runner = new Runner(supervisor);

let result = await runner.run(`
Start a debate on whether artificial intelligence will ultimately benefit or harm humanity.
Let Alice begin. Bob should respond. Keep going until it's clear the topic is fully explored.
`);

console.log("🧠 Supervisor:", result.final_message);

while (
  !result.final_message.toLocaleLowerCase().includes("conversation complete")
) {
  result = await runner.run({
    context: [
      ...result.context,
      { role: "user", content: "Continue the debate." },
    ],
  });

  console.log("🧠 Supervisor:", result.final_message);
}

// console.log(JSON.stringify(result.context, null, 2));
// console.log(runner.renderTraces());

console.log("🧠 Final result:", result.final_message);
