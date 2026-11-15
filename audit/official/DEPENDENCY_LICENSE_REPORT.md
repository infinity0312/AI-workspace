# 依赖许可证盘点

本次拟引入的官方源码和包数量为 0。根 LICENSE 和 core/agent-loop、core/session、core/system-prompt、core/tools、llm/llm-deepseek、llm/token-meter、skill、compaction、subagent、plan、todo、guard 的 package.json 均读到 MIT。官方适配器直接依赖 eventsource-parser、semver、schemastery、cosmokit、品牌与值工具，Agent Loop 直接依赖品牌与值工具、schemastery 和 Zod；工具、技能和提示词子系统也使用 Cordis 语义。项目无这些新增依赖，因而无需为引入包作传递许可证批准。固定官方 lockfile 可供未来另行核对实际要引入的完整子图。

[官方固定 package lock](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/pnpm-lock.yaml)
