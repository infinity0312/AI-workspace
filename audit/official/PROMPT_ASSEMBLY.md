# 提示词

固定提交 `e8f7b93a344964de3dca1ace9e72b6e4d6de87cb`。源码符号 `SystemPrompt 与 renderPrompt`，测试已读，官方套件未运行。`PromptSection` 按注册顺序与作用域组装，`renderContextSnapshot` 记录上下文；现有 `PromptId` 继续决定任务格式，增加稳定规则及受限技能。

[固定源码](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/core/system-prompt/src/index.ts) · [固定测试](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/core/system-prompt/tests/tool-order.spec.ts)
