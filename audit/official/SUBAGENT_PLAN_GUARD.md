# 子 Agent 与守卫

固定提交 `e8f7b93a344964de3dca1ace9e72b6e4d6de87cb`。源码符号 `SubagentRuntime`，测试已读，官方套件未运行。子会话由 SubagentRuntime 管理，`PlanModeController` 持有计划投影，repeat-tool-reminder 单独注册。保留单 Agent，只取调用预算和重复工具约束。子 Agent、Shell 和编码功能不纳入本项目。

[固定源码](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/subagent/subagent/src/index.ts) · [固定测试](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/subagent/subagent/tests/activation-policy.spec.ts)
