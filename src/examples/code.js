import { Agent } from "../Agent";
import prompts from "prompts";
import fs from "fs";
import { execSync } from "child_process";
import { glob } from "glob";
import { dirname, join } from "path";

async function main() {
  const BashTool = {
    name: "BashTool",
    description: "Executes shell commands in your environment",
    parameters: { command: { type: "string" } },
    callback: ({ command }) => {
      try {
        return execSync(command).toString();
      } catch (error) {
        return `Error executing command: ${error.message}`;
      }
    },
  };

  const GlobTool = {
    name: "GlobTool",
    description: "Finds files based on pattern matching",
    parameters: { pattern: { type: "string" } },
    callback: ({ pattern }) => {
      try {
        const formattedPattern = pattern
          .split(" ")
          .map((part) => part.trim())
          .join("");
        const results = glob.sync(formattedPattern);
        return results.length > 0 ? results : "No files matching pattern found";
      } catch (error) {
        return `Error in pattern matching: ${error.message}`;
      }
    },
  };

  const GrepTool = {
    name: "GrepTool",
    description: "Searches for patterns in file contents",
    parameters: { pattern: { type: "string" }, file: { type: "string" } },
    callback: ({ pattern, file }) => {
      try {
        if (!fs.existsSync(file)) {
          return `File ${file} does not exist`;
        }

        const fileContents = fs.readFileSync(file, "utf8");
        const matches = fileContents
          .split("\n")
          .filter((line) => line.includes(pattern));
        return matches.length > 0
          ? matches
          : `No matches found for pattern "${pattern}" in ${file}`;
      } catch (error) {
        return `Error searching file: ${error.message}`;
      }
    },
  };

  const LSTool = {
    name: "LSTool",
    description: "Lists files and directories",
    parameters: { path: { type: "string" } },
    callback: ({ path }) => {
      try {
        // Default to current directory if path is empty
        const dirPath = path.trim() === "" ? "." : path;

        if (!fs.existsSync(dirPath)) {
          return `Directory ${dirPath} does not exist`;
        }

        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        if (items.length === 0) {
          return `Directory ${dirPath} is empty`;
        }

        return items.map(
          (dirent) => `${dirent.name}${dirent.isDirectory() ? "/" : ""}`
        );
      } catch (error) {
        return `Error listing directory: ${error.message}`;
      }
    },
  };

  const FileReadTool = {
    name: "FileReadTool",
    description: "Reads the contents of files",
    parameters: { file: { type: "string" } },
    callback: ({ file }) => {
      try {
        if (!fs.existsSync(file)) {
          return `File ${file} does not exist`;
        }

        const content = fs.readFileSync(file, "utf8");
        return content.length > 0 ? content : `File ${file} is empty`;
      } catch (error) {
        return `Error reading file: ${error.message}`;
      }
    },
  };

  const FileEditTool = {
    name: "FileEditTool",
    description: "Makes targeted edits to specific files or creates new files",
    parameters: {
      file: { type: "string" },
      content: { type: "string" },
    },
    callback: ({ file, content }) => {
      try {
        const action = fs.existsSync(file) ? "updated" : "created";

        // Ensure the directory exists
        const dir = dirname(file);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(file, content);
        return `File ${file} successfully ${action}`;
      } catch (error) {
        return `Error editing file: ${error.message}`;
      }
    },
  };

  const CodeWritingAgent = new Agent({
    name: "CodeWritingAgent",
    purpose: `You're a highly capable, expert code writer. You can write any language with ease.
    You approach problems from a high level, and can solve complex problems with simple solutions.
    `,
    model: "o3-mini-2025-01-31",
  });

  const ProgrammingAgent = new Agent({
    name: "ProgrammingAgent",
    purpose: `You're an immensely powerful code agent, you build applications, scripts, tools, and more.
    Draft a plan first, then take a look at your environment and then start working.
    You can solve simple and complex tasks autonomously. 
    You can interact on the users computer, and on the internet.
    You orchestrate the operation, leveraging your tools and co-agents to get the job done.
    Only ask CodeWritingAgent to write or edit code for specific tasks. Don't ask him to do general or broad tasks.
    You orchestrate the project, he just writes code that you put into files. 
    `,
    tools: [BashTool, GlobTool, GrepTool, LSTool, FileReadTool, FileEditTool],
    web_search: {
      enabled: true,
    },
    sub_agents: [CodeWritingAgent],
  });

  while (true) {
    const response = await prompts({
      type: "text",
      name: "task",
      message: "> What should we work on?",
    });

    const result = await ProgrammingAgent.run(response.task);
    console.log(result);
  }
}

main().catch(console.error);
