# TODO List

- [ ] Ensure that function call w/ output_text _is properly_ resolved, it seems like the fixes put in place after noticing this occuring resolved it, but it was already quite rare so need to make sure. 
- [ ] Normalize Agent tool use, refactor down to a simpler _dry_er wrapper. 
- [ ] Add mcp context support
    - [ ] MCP Prompts
    - [ ] MCP Resources
- [ ] More involved agent examples
- [ ] Add Agent output_type to support structured schema output
- [ ] Find bugs
- [ ] UUID _everything_
- [ ] Debugging
- [X] Validate sub agent flow is proper, maybe sub agents need more context. (maybe we have a flow where agents decide what of their output / task was valid or useful context, kind of sounds like something a dev would decide on instead of loom itself? thinking. ) (Marking complete w/ addition of `examples/debate-orchestration.ts / debate.json sample`)
- [X] Per agent configs (ability to use claude for example for HTML Coding agents while using o3 for reasoning or deepseek for cheaper general agents) 
- [X] Add mcp tool support
- [X] Improved llms helper
- [X] Fix runners crashing with subsequent runs. (Allow more than 1 tracer or mutliple runner traces (each run its own trace))
- [X] Docs website
- [X] Refactor / implement a tracing system
- [X] Add completions API support (enables nearly any model/api router support)
