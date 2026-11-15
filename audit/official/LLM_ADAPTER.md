# 模型协议

固定提交 `e8f7b93a344964de3dca1ace9e72b6e4d6de87cb`。源码符号 `DeepSeekAdapter`，测试已读，官方套件未运行。`sse.ts::parseSse` 读增量，`translate.ts::translate` 转事件，`serialize.ts::serialize` 组装消息与工具；本项目固定 Chat Completions，独立实现有界增量、完成原因和用量。

[固定源码](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/llm/llm-deepseek/src/adapter.ts) · [固定测试](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/llm/llm-deepseek/tests/stream.spec.ts)
