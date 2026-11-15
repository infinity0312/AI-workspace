# 采用决策

| 能力 | 策略 | 权衡 |
|---|---|---|
| 模型增量、Session、Turn/Step、工具与提示词 | REIMPLEMENT_CONTRACT | 两侧同为 TypeScript，官方模块依赖 Cordis 及配套 workspace 服务，公开版本是 RC。本项目保留 NestJS、npm、SQL、现有授权与持久化，逐项复现协议行为。 |
| 技能目录与上下文剪裁 | REIMPLEMENT_CONTRACT | 固定技能目录和确定性裁剪可验证，减少文件权限、上下文成本和不可回放状态。 |
| 重复工具及预算守卫 | REIMPLEMENT_CONTRACT | 已有预算和租约可直接复用，增量状态有独立日志。 |
| 子 Agent、Coding Agent、Shell、终端和 Electron | DO_NOT_ADOPT | 当前已观测的问题来自来源约束、引用和语义范围。扩大工具面无法直接解决。 |

只依赖本项目实现测试证明契约。生产基线路径保持可选回退。官方源码和 npm 包均未进入产品依赖。
