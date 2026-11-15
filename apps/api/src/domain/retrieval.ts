import type { Database } from '../platform/database';

export type RetrievedPassage = { id:string; document_id:string; ordinal:number; page:number|null; offset_utf16:number;
  content:string; source_id:string; snapshot_id:string; workspace_id:string; title:string; recalled:boolean; memory_id:string|null; memory_quote:string|null };
const relationshipGoal = /关系|关联|依赖|影响|连接|relationship|dependenc|connect|influence/i;
export type RetrievalOptions = { corpus?:boolean; external?:boolean; embeddingProfile?:string };

const ignored = new Set(['the','and','for','how','what','with','about','this','分析','介绍','请','什么','关于','以及','如何','进行','有何','关系','关联','依赖','影响','连接','relationship','dependency']);
const segmenter = new Intl.Segmenter('zh',{ granularity:'word' });
function terms(query:string) {
  const words = [...segmenter.segment(query.normalize('NFKC').toLowerCase())];
  const normal = words.filter(part => part.isWordLike && part.segment.length > 1 && !ignored.has(part.segment)).map(part => part.segment);
  const adjacent = words.flatMap((part,index) => {
    const next = words[index+1];
    const pair = part.segment + (next?.segment ?? '');
    return part.segment.length === 1 && next?.segment.length === 1 && /^\p{Script=Han}{2}$/u.test(pair) && !ignored.has(pair) ? [pair] : [];
  });
  const unique = [...new Set([...normal,...adjacent])];
  const han = unique.filter(word => /\p{Script=Han}/u.test(word));
  const other = unique.filter(word => !/\p{Script=Han}/u.test(word));
  return han.length && other.length ? [...han.slice(0,12),...other.slice(0,12)] : unique.slice(0,24);
}

export function retrievePassages(db:Database,scope:{ workspace:string; project:string|null; sources:string[] },
  query:string,embedding?:number[],options:RetrievalOptions = {}) {
  if (!scope.sources.length && !options.corpus) return Promise.resolve([]);
  const value = embedding?.length && embedding.length <= 4096 && embedding.every(Number.isFinite) ? JSON.stringify(embedding) : null;
  return db.all<RetrievedPassage>(`WITH candidate AS (
    SELECT p.id,p.document_id,p.ordinal,p.page,p.offset_utf16,p.content,p.search_text,p.embedding,p.embedding_profile,
      d.source_id,d.snapshot_id,s.workspace_id,s.title,(s.id=ANY($2::uuid[])) AS explicit
    FROM sources s JOIN LATERAL (SELECT id,source_id,snapshot_id FROM documents WHERE source_id=s.id
      ORDER BY created_at DESC,id DESC LIMIT 1) d ON true JOIN passages p ON p.document_id=d.id
    WHERE s.workspace_id=$1 AND s.status='parsed' AND s.lifecycle IN ('active','updated')
      AND (NOT $8::boolean OR (s.sensitivity IN ('public','personal') AND s.rights <> 'restricted'))
      AND (
        (s.id=ANY($2::uuid[]) AND (s.project_id IS NULL OR s.project_id=$4 OR EXISTS (
          SELECT 1 FROM project_relations pr WHERE pr.workspace_id=$1 AND pr.from_id=$4 AND pr.to_id=s.project_id)))
        OR ($7::boolean AND (s.project_id IS NULL OR s.project_id=$4))
      )
  ), scored AS (
    SELECT p.*,ts_rank_cd(search_text,plainto_tsquery('simple',$3)) +
      (SELECT count(*)::double precision FROM unnest($6::text[]) term WHERE strpos(lower(p.content),term)>0) AS lexical,
      CASE WHEN $5::vector IS NOT NULL AND embedding_profile=$10 AND embedding IS NOT NULL AND vector_dims(embedding)=vector_dims($5::vector)
        THEN 1 - (embedding <=> $5::vector) ELSE NULL END AS semantic
    FROM candidate p
  ), text_rank AS (
    SELECT id,row_number() OVER(ORDER BY lexical DESC,ordinal,id) AS rank FROM scored
    WHERE lexical>0 ORDER BY lexical DESC,ordinal,id LIMIT 48
  ), vector_rank AS (
    SELECT id,row_number() OVER(ORDER BY semantic DESC,id) AS rank FROM scored
    WHERE semantic>=0.32 ORDER BY semantic DESC,id LIMIT 48
  ), matched_memory AS (
    SELECT DISTINCT ON (e.passage_id) e.passage_id AS id,e.id AS evidence_id,e.quote,c.reviewed_at
    FROM claims c JOIN claim_evidence ce ON ce.claim_id=c.id JOIN evidence e ON e.id=ce.evidence_id
    JOIN candidate p ON p.id=e.passage_id AND p.snapshot_id=e.snapshot_id
    WHERE $7::boolean AND c.workspace_id=$1 AND c.status='supported' AND e.verification_status='located'
      AND EXISTS (SELECT 1 FROM unnest($6::text[]) term WHERE strpos(lower(c.statement || ' ' || c.scope),term)>0)
    ORDER BY e.passage_id,c.reviewed_at DESC NULLS LAST,e.id
  ), graph_recall AS (
    SELECT DISTINCT ON (e.passage_id) e.passage_id AS id,e.id AS evidence_id,e.quote,ke.created_at AS reviewed_at
    FROM knowledge_edges ke JOIN knowledge_nodes a ON a.id=ke.from_node_id JOIN knowledge_nodes b ON b.id=ke.to_node_id
    JOIN evidence e ON e.id=ke.evidence_id JOIN candidate p ON p.id=e.passage_id AND p.snapshot_id=e.snapshot_id
    WHERE $7::boolean AND $9::boolean AND ke.workspace_id=$1 AND ke.status='confirmed'
      AND a.status='confirmed' AND b.status='confirmed' AND e.verification_status='located'
      AND (a.project_id IS NULL OR a.project_id=$4) AND (b.project_id IS NULL OR b.project_id=$4)
      AND EXISTS (SELECT 1 FROM unnest($6::text[]) term WHERE strpos(lower(a.title || ' ' || b.title),term)>0)
    ORDER BY e.passage_id,ke.created_at DESC,e.id
  ), combined_memory AS (
    SELECT DISTINCT ON (id) * FROM (SELECT * FROM matched_memory UNION ALL SELECT * FROM graph_recall) recalled
    ORDER BY id,reviewed_at DESC NULLS LAST,evidence_id
  ), memory AS (
    SELECT * FROM combined_memory ORDER BY reviewed_at DESC NULLS LAST,id LIMIT 24
  ), fused AS (
    SELECT p.id,p.document_id,p.ordinal,p.page,p.offset_utf16,p.content,p.source_id,p.snapshot_id,p.workspace_id,p.title,
      (m.id IS NOT NULL) AS recalled,m.evidence_id AS memory_id,m.quote AS memory_quote,
      COALESCE(1.0/(60+t.rank),0) + COALESCE(1.0/(60+v.rank),0) + CASE WHEN m.id IS NOT NULL THEN 0.02 ELSE 0 END AS score
    FROM scored p LEFT JOIN text_rank t ON t.id=p.id LEFT JOIN vector_rank v ON v.id=p.id LEFT JOIN memory m ON m.id=p.id
    WHERE t.id IS NOT NULL OR v.id IS NOT NULL OR m.id IS NOT NULL OR p.explicit
  ), diversified AS (
    SELECT *,row_number() OVER(PARTITION BY source_id ORDER BY score DESC,ordinal,id) AS source_rank FROM fused
  )
  SELECT id,document_id,ordinal,page,offset_utf16,content,source_id,snapshot_id,workspace_id,title,recalled,memory_id,memory_quote
  FROM diversified WHERE source_rank <= 4 ORDER BY score DESC,source_rank,id LIMIT 20`,
    [scope.workspace,scope.sources,query,scope.project,value,terms(query),Boolean(options.corpus),Boolean(options.external),relationshipGoal.test(query),options.embeddingProfile ?? null]);
}
