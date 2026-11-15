import { posix } from 'node:path';
import { officeMime } from '@akw/contracts';
import { unzipSync } from 'fflate';
import { SaxesParser, type SaxesTagPlain } from 'saxes';
import { invalid } from '../platform/errors';

type Hooks = { open?(tag: SaxesTagPlain): void; close?(tag: SaxesTagPlain): void; text?(text: string): void };
export const isOffice = (mime: string) => Object.values(officeMime).some(value => value === mime);
const local = (name: string) => name.split(':').at(-1);
function xml(raw: Uint8Array | undefined, hooks: Hooks) {
  if (!raw) throw invalid('Office document part is missing');
  const bytes = new TextDecoder('utf-8',{ fatal:true }).decode(raw);
  const parser = new SaxesParser({ xmlns:false });
  parser.on('doctype',() => { throw invalid('Office XML document type declarations are unavailable'); });
  if (hooks.open) parser.on('opentag',hooks.open);
  if (hooks.close) parser.on('closetag',hooks.close);
  if (hooks.text) { parser.on('text',hooks.text); parser.on('cdata',hooks.text); }
  parser.write(bytes).close();
}
const allowedXml = /^(?:\[Content_Types\]\.xml|word\/document\.xml|ppt\/presentation\.xml|ppt\/_rels\/presentation\.xml\.rels|ppt\/slides\/slide\d+\.xml|xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/worksheets\/sheet\d+\.xml)$/;
function officeFiles(bytes: Buffer) {
  let count = 0;
  let total = 0;
  const seen = new Set<string>();
  try {
    return unzipSync(bytes,{ filter(entry) {
      if (++count > 4000) throw invalid('Office archive has too many parts');
      if (!allowedXml.test(entry.name)) return false;
      if (seen.has(entry.name)) throw invalid('Office archive contains duplicate XML parts');
      seen.add(entry.name);
      total += entry.originalSize;
      if (entry.originalSize > 8 * 1024 * 1024 || total > 32 * 1024 * 1024) throw invalid('Office XML exceeds extraction limits');
      return true;
    } });
  } catch {
    throw invalid('Office file is invalid or exceeds extraction limits');
  }
}
function paragraphs(data: Uint8Array | undefined, container = 'p') {
  let within = 0;
  let textNode = 0;
  let current = '';
  const parts: string[] = [];
  xml(data,{
    open(tag) {
      const name = local(tag.name);
      if (name === container) within++;
      if (name === 't') textNode++;
      if (within && name === 'tab') current += '\t';
      if (within && name === 'br') current += '\n';
    },
    text(text) { if (within && textNode) current += text; },
    close(tag) {
      const name = local(tag.name);
      if (name === 't') textNode--;
      if (name === container && --within === 0) { parts.push(current); current = ''; }
    },
  });
  return parts;
}

function orderedParts(files: Record<string,Uint8Array>, main: string, itemName: string, valid: RegExp) {
  const base = posix.dirname(main);
  const targets = new Map<string,string>();
  xml(files[base + '/_rels/' + posix.basename(main) + '.rels'],{
    open(tag) {
      if (local(tag.name) !== 'Relationship' || tag.attributes.TargetMode?.toLowerCase() === 'external') return;
      const { Id,Target } = tag.attributes;
      if (!Id || !Target) return;
      const path = Target.startsWith('/') ? Target.slice(1) : posix.normalize(posix.join(base,Target));
      if (valid.test(path)) targets.set(Id,path);
    },
  });
  const parts: { name: string; path: string }[] = [];
  xml(files[main],{
    open(tag) {
      if (local(tag.name) !== itemName) return;
      const relation = Object.entries(tag.attributes).find(([key]) => key.endsWith(':id'))?.[1];
      const path = relation ? targets.get(relation) : undefined;
      if (path) parts.push({ name:tag.attributes.name ?? '',path });
    },
  });
  return parts;
}
function sheetRows(raw: Uint8Array | undefined, shared: string[]) {
  let current: { ref: string; kind: string; value: string } | null = null;
  let row: string[] = [];
  let reading = 0;
  const rows: string[] = [];
  xml(raw,{
    open(tag) {
      const name = local(tag.name);
      if (name === 'row') row = [];
      if (name === 'c') current = { ref:tag.attributes.r ?? '',kind:tag.attributes.t ?? '',value:'' };
      if (name === 'v' || name === 't') reading++;
    },
    text(text) { if (current && reading) current.value += text; },
    close(tag) {
      const name = local(tag.name);
      if (name === 'v' || name === 't') reading--;
      if (name === 'c' && current) {
        const value = current.kind === 's' && /^\d+$/.test(current.value) ? shared[Number(current.value)] ?? '' : current.value;
        if (value) row.push(current.ref ? current.ref + ': ' + value : value);
        current = null;
      }
      if (name === 'row' && row.length) rows.push(row.join(' | '));
    },
  });
  return rows.join('\n\n');
}
export function parseOffice(bytes: Buffer, mime: string) {
  const files = officeFiles(bytes);
  xml(files['[Content_Types].xml'],{});
  if (mime === officeMime.docx) {
    return { pages:0,sections:[{ page:null,text:paragraphs(files['word/document.xml']).join('\n\n') }],
      warnings:['Word uses paragraph offsets. Pagination, images and advanced layout are not evaluated.'] };
  }
  if (mime === officeMime.pptx) {
    const slides = orderedParts(files,'ppt/presentation.xml','sldId',/^ppt\/slides\/slide\d+\.xml$/);
    return { pages:slides.length,sections:slides.slice(0,150).map((part,index) => ({ page:index+1,text:paragraphs(files[part.path]).join('\n\n') })),
      warnings:['Slides use presentation order. Visual elements and speaker notes are not transcribed.',...(slides.length > 150 ? ['Slide limit reached (150)'] : [])] };
  }
  const sheets = orderedParts(files,'xl/workbook.xml','sheet',/^xl\/worksheets\/sheet\d+\.xml$/);
  const strings = files['xl/sharedStrings.xml'] ? paragraphs(files['xl/sharedStrings.xml'],'si') : [];
  return { pages:sheets.length,sections:sheets.slice(0,60).map((part,index) => ({ page:index+1,text:part.name + '\n\n' + sheetRows(files[part.path],strings) })),
    warnings:['Workbook positions use sheet order and cell addresses. Formulae are not executed.',...(sheets.length > 60 ? ['Sheet limit reached (60)'] : [])] };
}
