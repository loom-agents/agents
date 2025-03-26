# TODO List

- [ ] Add mcp context support
    - [ ] MCP Prompts
    - [ ] MCP Resources
- [ ] Validate sub agent flow is proper, maybe sub agents need more context. (maybe we have a flow where agents decide what of their output / task was valid or useful context, kind of sounds like something a dev would decide on instead of loom itself? thinking. )
- [ ] More involved agent examples
- [ ] Per agent configs (ability to use claude for example for HTML Coding agents while using o3 for reasoning or deepseek for cheaper general agents) 
- [ ] Find bugs
- [ ] UUID _everything_
- [ ] Normalize Agent tool use, refactor down to a simpler _dry_er wrapper. 
- [ ] Debugging
- [X] Add mcp tool support
- [X] Improved llms helper
- [X] Fix runners crashing with subsequent runs. (Allow more than 1 tracer or mutliple runner traces (each run its own trace))
- [X] Docs website
- [X] Refactor / implement a tracing system
- [X] Add completions API support (enables nearly any model/api router support)
