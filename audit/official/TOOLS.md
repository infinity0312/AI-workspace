# 工具

固定提交 `e8f7b93a344964de3dca1ace9e72b6e4d6de87cb`。源码符号 `ToolExecutionPipeline.prepare`，测试已读，官方套件未运行。先做解析与执行策略检查，随后调用具体 executor 并关联 tool call/result。当前仅接入本次证据清单里的只读证据工具，授权由领域服务注入。

[固定源码](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/core/tools/src/pipeline.ts) · [固定测试](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/core/tools/tests/tools.spec.ts)
