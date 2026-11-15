import type { ArtifactDocument, Block } from './index';

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([,item]) => item !== undefined)
      .sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key,item]) => [key,sorted(item)]));
  }
  return value;
}

export const sameContent = (left: unknown, right: unknown) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));

export class DocumentMergeConflict extends Error {
  constructor(message: string, readonly blockId?: string) { super(message); }
}

const segmenter = new Intl.Segmenter(undefined, { granularity:'grapheme' });
function textEdit(base: string, value: string) {
  const a = [...segmenter.segment(base)].map(item => item.segment);
  const b = [...segmenter.segment(value)].map(item => item.segment);
  let first = 0;
  while (first < a.length && first < b.length && a[first] === b[first]) first++;
  let endA = a.length;
  let endB = b.length;
  while (endA > first && endB > first && a[endA-1] === b[endB-1]) { endA--; endB--; }
  return { start:a.slice(0,first).join('').length, end:a.slice(0,endA).join('').length, text:b.slice(first,endB).join('') };
}

function mergeInlineText(base: Block, current: Block, incoming: Block) {
  const baseline = base.children;
  if (!baseline || baseline.length !== current.children?.length || baseline.length !== incoming.children?.length ||
    !sameContent({ ...base,children:[] },{ ...current,children:[] }) ||
    !sameContent({ ...base,children:[] },{ ...incoming,children:[] })) return;
  const children = [];
  for (const [i, original] of baseline.entries()) {
    const theirs = current.children[i]!;
    const ours = incoming.children[i]!;
    if (sameContent(original,ours)) { children.push(theirs); continue; }
    if (sameContent(original,theirs) || sameContent(ours,theirs)) { children.push(ours); continue; }
    const { text,...metadata } = original;
    const { text:other,...otherMetadata } = theirs;
    const { text:mine,...myMetadata } = ours;
    if (original.type !== 'text' || text === undefined || other === undefined || mine === undefined ||
      !sameContent(metadata,otherMetadata) || !sameContent(metadata,myMetadata)) return;
    const [first, second] = [textEdit(text,other),textEdit(text,mine)].sort((a,b) => a.start-b.start);
    if (first!.end > second!.start || first!.start === second!.start) return;
    children.push({ ...original,text:text.slice(0,first!.start) + first!.text +
      text.slice(first!.end,second!.start) + second!.text + text.slice(second!.end) });
  }
  return { ...base,children };
}

export function mergeArtifactDocuments(base: ArtifactDocument, current: ArtifactDocument, incoming: ArtifactDocument): ArtifactDocument {
  const baseById = new Map(base.blocks.map(block => [block.id,block]));
  const currentById = new Map(current.blocks.map(block => [block.id,block]));
  const incomingById = new Map(incoming.blocks.map(block => [block.id,block]));
  const order = base.blocks.map(block => block.id);
  const currentOrder = current.blocks.map(block => block.id);
  const incomingOrder = incoming.blocks.map(block => block.id);
  const currentMoved = !sameContent(order,currentOrder);
  const incomingMoved = !sameContent(order,incomingOrder);
  if (currentMoved && incomingMoved && !sameContent(currentOrder,incomingOrder)) {
    throw new DocumentMergeConflict('Block ordering changed on both revisions');
  }
  const resolved = new Map<string,Block>();
  for (const blockId of new Set([...order,...currentOrder,...incomingOrder])) {
    const original = baseById.get(blockId);
    const theirs = currentById.get(blockId);
    const ours = incomingById.get(blockId);
    let result: Block | undefined;
    if (sameContent(original,ours)) result = theirs;
    else if (sameContent(original,theirs) || sameContent(ours,theirs)) result = ours;
    else {
      result = original && theirs && ours ? mergeInlineText(original,theirs,ours) : undefined;
      if (!result) throw new DocumentMergeConflict('Overlapping changes in a content block',blockId);
    }
    if (result) resolved.set(blockId,result);
  }
  const a = base.relations, b = current.relations, c = incoming.relations;
  if (!sameContent(a,b) && !sameContent(a,c) && !sameContent(b,c)) throw new DocumentMergeConflict('Artifact relations changed concurrently');
  return {
    ...current,
    blocks:(incomingMoved ? incomingOrder : currentOrder).flatMap(id => {
      const block = resolved.get(id);
      return block ? [block] : [];
    }),
    relations:sameContent(a,c) ? b : c,
  };
}
