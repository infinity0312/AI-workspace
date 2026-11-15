# 05 --- Research, Ingestion & Retrieval

## 1. Research Pipeline

``` text
User Goal
  → Intent / Scope
  → Research Plan
  → Search
  → Source Registration
  → Fetch / Import
  → Asset Validation
  → Document Parsing
  → Quality Assessment
  → Chunking
  → Embedding / Indexing
  → Evidence Extraction
  → Claim Synthesis
  → Validation
  → Artifact Draft
```

## 2. Search Providers

通过 Provider Adapter 接入搜索服务。统一输出： - title - canonical_url -
snippet - source_type - published_at - retrieved_at - author / publisher
metadata - access status - provider metadata - rights
hints（非法律结论）

搜索结果不等于证据。需要抓取或用户导入后才能建立可靠 Evidence。

## 3. Source Normalization

-   URL canonicalization。
-   DOI / ISBN / 官方文档标识识别。
-   同源去重。
-   重定向追踪。
-   域名和出版者元数据。
-   来源访问状态。
-   版权与再分发限制标记。
-   检索时间和快照版本。

## 4. Ingestion Pipeline

支持优先级： - PDF。 - HTML 网页。 - DOCX / PPTX / XLSX。 - 图片 OCR。 -
纯文本 / Markdown。 - 音频和视频后续扩展。

每种格式使用独立 Parser Adapter，输出统一 Document IR（Intermediate
Representation）。

## 5. Document IR

建议包含： - document metadata - pages - sections - paragraphs -
tables - figures - captions - formulas - references - source locators -
extraction confidence / warnings

保留原始页码、段落位置、表格坐标等 locator，以便 Evidence 回溯。

## 6. Document Quality Assessment

每份文档产生质量报告： - text extraction - layout detection - table
extraction - figure extraction - formula extraction - OCR coverage -
page coverage - parser version - warnings / affected pages

质量分数必须来自实际可量化规则或测试，不允许 LLM 凭感觉打分。

质量不足时： - 标记不确定区域。 - 支持局部重新解析。 -
展示原始文件对照。 - 不把未成功提取内容当作已理解内容。

## 7. Chunking

Chunk 应保留： - chunk_id - document_id - section_id - page range -
character / token offsets - content hash - parser version - embedding
status

按文档结构切分优先，不应只按固定字符长度粗暴切分。

## 8. Retrieval

建议 Hybrid Retrieval： - BM25 / PostgreSQL Full Text Search。 -
pgvector semantic search。 - RRF 融合。 - Reranker。 - Metadata /
permission filtering。

权限过滤必须在检索结果返回前执行，不能先检索所有租户内容再在 Prompt
中过滤。

## 9. Retrieval Evaluation

建立离线评测集： - Recall@K - Precision@K - MRR - NDCG - Evidence Hit
Rate - Citation Accuracy - Permission Leakage Rate（必须为 0）

区分： - 找到相关文档。 - 找到相关段落。 - 找到真正支持答案的证据。

## 10. 资料来源分层

记录来源类型，不使用单一相似度判断可信度： - 原始研究论文。 -
综述论文。 - 官方文档。 - 标准和法规。 - 新闻报道。 - 社区讨论。 -
用户上传资料。 - 教材和书籍。

来源质量是上下文属性，不应由一个固定数字决定所有领域的可信度。

## 11. 网络与文件安全

抓取服务必须防护： - SSRF。 - localhost / private IP / cloud metadata
地址。 - DNS rebinding。 - 非法重定向。 - 超大响应。 - 无限递归。 - 非法
MIME。 - 恶意文件和压缩炸弹。 - 超时与资源耗尽。

所有下载必须限制大小、时间、重定向次数和允许协议。

## 12. 异步任务

解析、OCR、Embedding、导出使用异步 Worker： - 任务状态持久化。 -
幂等键。 - 有限重试。 - 死信队列。 - 可取消。 - 可观察。 -
部分成功结果保留。

Embedding 失败不能阻止 Artifact 保存。
