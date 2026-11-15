# 技能

固定提交 `e8f7b93a344964de3dca1ace9e72b6e4d6de87cb`。源码符号 `SkillRegistry`，测试已读，官方套件未运行。先暴露 `SkillSummary`，再加载 `SkillDefinition`；`FileSystemSkillProvider` 属于另一个包。本项目将技能固定在发布目录，按任务加载，拒绝外部路径。

[固定源码](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/skill/skill/src/index.ts) · [固定测试](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/skill/skill/tests/skill.spec.ts)
