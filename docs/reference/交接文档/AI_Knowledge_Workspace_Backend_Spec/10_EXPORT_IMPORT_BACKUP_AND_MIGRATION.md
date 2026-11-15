# 10 --- Export, Import, Backup & Migration

## 1. 导出目标

导出不只是打印文档，而是让用户拥有可迁移的知识资产。

## 2. 导出格式

  格式                    用途
  ----------------------- ----------------
  Markdown                笔记与双链迁移
  PDF                     阅读和分享
  DOCX                    继续编辑
  HTML                    网页阅读
  JSON                    结构化数据
  ZIP Workspace Archive   完整备份与迁移

## 3. Workspace Archive

``` text
workspace-export.zip
├── manifest.json
├── workspace/
├── projects/
├── artifacts/
│   ├── artifact.json
│   └── revisions/
├── knowledge/
│   ├── nodes.json
│   ├── edges.json
│   └── claims.json
├── sources/
│   ├── sources.json
│   └── evidence.json
├── assets/
├── history/
└── checksums.json
```

## 4. Manifest

必须包含： - format identifier - format version - export timestamp -
workspace identifier - included datasets - asset manifest - checksum
algorithm - source rights / excluded asset report - schema versions

## 5. 两种导出模式

### Full Backup

包含用户拥有且允许导出的结构化知识、Artifact、必要历史、来源元数据、Evidence
和原始资产。

### Lightweight Migration

包含 Artifact、知识关系、来源元数据和引用，不强制携带全部原始文件。

对受版权或权限限制的内容，按策略排除全文或二进制资源，并在 manifest
中说明。

## 6. Import Pipeline

1.  上传归档。
2.  病毒和压缩包安全扫描。
3.  校验 Manifest。
4.  校验 checksums。
5.  校验 Schema 版本。
6.  执行 Dry Run。
7.  展示冲突和不支持内容。
8.  用户确认。
9.  分批导入。
10. 建立 ID 映射。
11. 恢复关系和引用。
12. 生成导入报告。

导入必须支持幂等或可恢复，失败时不得留下无法解释的半成品。

## 7. 备份与恢复

云端： - PostgreSQL 全量备份。 - WAL 归档。 - Point-in-Time Recovery。 -
对象存储版本保护。 - 异地备份。 - 定期恢复演练。

用户： - 手动完整导出。 - 可下载 ZIP。 - 支持恢复到新 Workspace。 -
支持数据校验。

同步不是备份；同步删除不能代替历史恢复能力。

## 8. Schema Migration

-   每个数据协议有版本号。
-   数据库迁移有顺序和回滚/补偿策略。
-   Artifact Schema 有纯函数或可测试迁移器。
-   旧客户端版本需要兼容策略。
-   未知 Block 类型不得静默丢弃。
-   导入旧归档时先转换到当前 Canonical Schema。

## 9. 恢复验收

至少验证： - Workspace / Project 数量一致。 - Artifact 内容 hash
一致。 - Knowledge Edge 引用完整。 - Evidence locator 可解析。 - Asset
checksum 一致。 - Revision 链完整。 - 权限与 owner 正确。
