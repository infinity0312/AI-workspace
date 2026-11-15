# 模块源码地图

| 能力 | 审计说明 | 源码入口 |
|---|---|---|
| 模型协议 | [审计](LLM_ADAPTER.md) | `packages/llm/llm-deepseek/src/adapter.ts::DeepSeekAdapter` |
| Turn 与 Step | [审计](AGENT_LOOP.md) | `packages/core/agent-loop/src/agent.ts::ReactLoopAgent` |
| 事件与回放 | [审计](SESSION.md) | `packages/core/session/src/index.ts::Session.append 与 deriveMessages` |
| 提示词 | [审计](PROMPT_ASSEMBLY.md) | `packages/core/system-prompt/src/index.ts::SystemPrompt 与 renderPrompt` |
| 工具 | [审计](TOOLS.md) | `packages/core/tools/src/pipeline.ts::ToolExecutionPipeline.prepare` |
| 技能 | [审计](SKILLS.md) | `packages/skill/skill/src/index.ts::SkillRegistry` |
| 上下文 | [审计](CONTEXT_COMPACTION.md) | `packages/compaction/compaction-tool-result-pruner/src/index.ts::ToolResultPruner` |
| 子 Agent 与守卫 | [审计](SUBAGENT_PLAN_GUARD.md) | `packages/subagent/subagent/src/index.ts::SubagentRuntime` |
