# Turn 与 Step

固定提交 `e8f7b93a344964de3dca1ace9e72b6e4d6de87cb`。源码符号 `ReactLoopAgent`，测试已读，官方套件未运行。`followup/steer/cancel` 驱动 inbox，先追加 `step/start`，固化请求后提交 assistant/message，执行工具后按顺序追加 tool/result，再进入下一 Step。映射为 Job 持有 Turn、只读工具的有界 Step。另检查 `resume.spec.ts` 和 `cancel.spec.ts`。

[固定源码](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/core/agent-loop/src/agent.ts) · [固定测试](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/core/agent-loop/tests/tool-calls.spec.ts)
