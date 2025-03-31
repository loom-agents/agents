import { test, expect } from "@playwright/test";
import { Agent, Loom, MCPServerSSE, MCPServerStdio, Runner } from "loom-agents";

// Loom.api = "completions";

test("Simple Agent responds with a simple message", async () => {
  const simpleAgent = new Agent({
    name: "Simple Agent",
    purpose: "Provide a simple response",
  });
  const result = await simpleAgent.run("Say something simple");
  console.log(`[SIMPLE] Result:`, result);

  expect(JSON.stringify(result).toLocaleLowerCase()).toContain("simple");
});

test("Agent Delegation forwards to correct sub-agents", async () => {
  const mathTutorAgent = new Agent({
    name: "Math Tutor",
    purpose: "Help with math problems. Explain your reasoning with examples.",
  });

  const historyTutorAgent = new Agent({
    name: "History Tutor",
    purpose: "Assist with historical queries and provide context.",
  });

  const delegationAgent = new Agent({
    name: "Delegation Agent",
    purpose: `
      Forward queries to appropriate sub-agents.
      Use Math Tutor for math questions and History Tutor for historical questions.
    `,
    sub_agents: [mathTutorAgent, historyTutorAgent],
  });

  const [mathResult, historyResult] = await Promise.all([
    delegationAgent.run("What is 3 * 3?"),
    delegationAgent.run("Tell me about the causes of World War I"),
  ]);

  console.log(`[DELEGATION] Math Result:`, mathResult);
  console.log(`[DELEGATION] History Result:`, historyResult);

  const foundMath =
    mathResult.context.find((c: any) => c.role === "tool") ||
    mathResult.context.find((c: any) => c.type === "function_call_output");
  expect(foundMath).toBeTruthy();

  const foundHistory =
    historyResult.context.find((c: any) => c.role === "tool") ||
    historyResult.context.find((c: any) => c.type === "function_call_output");
  expect(foundHistory).toBeTruthy();
});

test("Deep Researcher provides detailed analysis", async () => {
  const deepResearcher = new Agent({
    name: "Deep Researcher",
    purpose: "Provide deep, thorough research and analysis on given topics",
    web_search: {
      enabled: true,
    },
  });
  const query = "Explain the impacts of climate change on global agriculture";
  const result = await deepResearcher.run(query);
  console.log(`[DEEP RESEARCH] Result:`, result);

  expect(JSON.stringify(result).toLocaleLowerCase()).toContain("climate");
});

test("Mixed Agent handles combined queries", async () => {
  const mixedAgent = new Agent({
    name: "Mixed Agent",
    purpose: "Handle both factual and creative queries",
  });
  const query = "Describe a futuristic city and calculate 10+5";
  const result = await mixedAgent.run(query);
  console.log(`[MIXED] Result:`, result);

  expect(JSON.stringify(result).toLocaleLowerCase()).toContain("futuristic");

  expect(JSON.stringify(result)).toMatch(/15/);
});

test("Agent using tools correctly calls its tools", async () => {
  const toolAgent = new Agent({
    name: "Tool Agent",
    purpose: "Use tools to fetch current data",
    tools: [
      {
        name: "DummyTool",
        description: "Returns a fixed value",
        parameters: {},
        callback: () => {
          return {
            success: true,
            message: "Tool executed successfully",
            data: "fixed value",
          };
        },
      },
    ],
  });
  const result = await toolAgent.run("Use the dummy tool");
  console.log(`[USING TOOLS] Result:`, result);

  expect(JSON.stringify(result).toLocaleLowerCase()).toContain(
    "tool executed successfully"
  );
});

test("Web Search Agent retrieves web search results", async () => {
  const webSearchAgent = new Agent({
    name: "Web Search Agent",
    purpose: "Perform web searches and return relevant results",
    web_search: {
      enabled: true,
    },
  });

  const result = await webSearchAgent.run("Search for latest tech news");
  console.log(`[WEB SEARCH] Result:`, result);

  expect(JSON.stringify(result).toLocaleLowerCase()).toContain("tech");
});

test("Content Production System combines multiple agents / Runners run agents", async () => {
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

  console.log(`[CONTENT PRODUCTION] Result:`, result);
  expect(JSON.stringify(result).toLocaleLowerCase()).toContain("renewable");
});

test("Agents with MCP", async () => {
  const mcpAgent = new Agent({
    name: "You run one of the mcp tools",
    purpose: "Run an mcp tool!",
    mcp_servers: [
      new MCPServerSSE(new URL("http://localhost:3001/sse")),
      new MCPServerStdio("bun", ["stdio.ts"]),
    ],
  });

  const result = await mcpAgent.run(
    "Run an mcp tool with any required input, make up input"
  );
  console.log(`[MCP] Result:`, result);
  expect(JSON.stringify(result).toLocaleLowerCase()).toContain(
    "function" // Kinda hacky, but allows for completions and responses to pass
  );
});

test("Agent specific OpenAI client configs (different model providers)", async () => {
  const deepseekAgent = new Agent({
    name: "ModelDeligator",
    purpose: "Are you deepseek or chatgpt? You tell me!", // this test might actually fail because of how they... made deepseek?
    model: "deepseek-chat",
    api: "completions",
    client_config: {
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEKSEEK_API_KEY,
    },
  });

  const result = await deepseekAgent.run("What model are you running?");
  console.log(`Deepseek Result:`, result);
  expect(JSON.stringify(result).toLocaleLowerCase()).toContain("deepseek");
});
