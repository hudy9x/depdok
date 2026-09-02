## What's Changed

✨ Features

- Implement tool router classification system with real-time debug interface and multi-layer triage ([2f15643](../../commit/2f15643))
- Implement LLM history compaction and reorganize runtime modules ([a61ed21](../../commit/a61ed21))
- Implement sliding window context budgeting to dynamically manage conversation token usage and display usage metrics in UI. ([794c579](../../commit/794c579))
- Track and display cumulative LLM token usage metrics per message in the chat UI ([41717e9](../../commit/41717e9))

♻️ Refactoring

- Simplify model selector UI to a compact icon button and adjust input actions layout ([3cd3f2b](../../commit/3cd3f2b))
- Modularize llm2 agent by introducing a dedicated client abstraction, custom stream parsing, and unified tool dispatching. ([048f820](../../commit/048f820))
- Clarify LLM multi-step execution guidelines to prohibit filler text during intermediate turns and mandate summaries upon completion ([33c4069](../../commit/33c4069))
- Enhance spreadsheet SDK with async persistence, multi-turn agent logic, and style support validation ([b960acc](../../commit/b960acc))

📝 Documentation

- Add documentation for llm tool-router architecture ([de8ae94](../../commit/de8ae94))
- Condense feature overview and expand technical details on AI orchestration and tool-calling capabilities ([878318a](../../commit/878318a))

🔨 Other Changes

- Add a deploy test pipeline ([2e3ace9](../../commit/2e3ace9))
- Upgrade version 0.71.0 ([a205cd7](../../commit/a205cd7))


📋 Full Changelog: [a205cd7...2e3ace9](../../compare/a205cd7...2e3ace9)