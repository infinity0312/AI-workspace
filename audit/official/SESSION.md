# 事件与回放

固定提交 `e8f7b93a344964de3dca1ace9e72b6e4d6de87cb`。源码符号 `Session.append 与 deriveMessages`，测试已读，官方套件未运行。`SessionStore.prepare` 加载会话，追加事实形成消息投影；本项目采用 Postgres 事件日志和既有租约，隔离公开进度和私有模型数据。

[固定源码](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/core/session/src/index.ts) · [固定测试](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/core/session/tests/message-projections.spec.ts)
