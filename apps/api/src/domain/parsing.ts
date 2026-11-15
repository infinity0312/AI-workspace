import { PDFParse } from 'pdf-parse';
import { officeMime } from '@akw/contracts';
import { invalid } from '../platform/errors';
import { isOffice, parseOffice } from './office';
import { checkImage, isImage, readImageText } from './ocr';
import { htmlText } from './html-text';

export interface PassageDraft { page: number | null; offset: number; content: string }
export interface ParsedDocument {
  parser: string;
  pages: number;
  passages: PassageDraft[];
  warnings: string[];
}
function split(text: string, page: number | null, offset = 0): PassageDraft[] {
  const paragraphs = /\S[\s\S]*?(?=\n\s*\n|$)/g;
  const passages: PassageDraft[] = [];
  for (const match of text.matchAll(paragraphs)) {
    const paragraph = match[0].trimEnd();
    let index = 0;
    for (const part of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(paragraph)) {
      if (part.index - index < 1200) continue;
      passages.push({ page, offset: offset + match.index + index, content: paragraph.slice(index, part.index) });
      index = part.index;
    }
    if (index < paragraph.length) passages.push({ page, offset: offset + match.index + index, content: paragraph.slice(index) });
  }
  return passages;
}

export async function parseDocument(bytes: Buffer, mime: string, signal?: AbortSignal): Promise<ParsedDocument> {
  signal?.throwIfAborted();
  if (isOffice(mime)) {
    let parsed: ReturnType<typeof parseOffice>;
    try { parsed = parseOffice(bytes,mime); } catch { throw invalid('Office document is invalid or exceeds extraction limits'); }
    const sections = parsed.sections;
    const warnings = [...parsed.warnings];
    const limit = 1_500_000;
    let remaining = limit;
    const passages: PassageDraft[] = [];
    for (const section of sections) {
      if (remaining <= 0 || passages.length >= 1500) break;
      const text = section.text.slice(0,remaining);
      remaining -= text.length;
      passages.push(...split(text,section.page));
    }
    if (!passages.length) warnings.push('No extractable text');
    if (remaining <= 0 || passages.length > 1500) warnings.push('Extraction size limit reached');
    const format = mime === officeMime.docx ? 'docx' : mime === officeMime.pptx ? 'pptx' : 'xlsx';
    return { parser:'office-xml/' + format + '/v1',pages:parsed.pages,passages:passages.slice(0,1500),warnings };
  }
  if (isImage(mime)) {
    const result = await readImageText(bytes,mime,signal);
    const passages = split(result.text,1).slice(0,1500);
    const warnings = ['OCR text should be verified against the original image.'];
    if (!passages.length) warnings.push('No recognizable text');
    else warnings.push('Mean OCR confidence: ' + result.confidence + '%');
    return { parser:'tesseract/eng+chi_sim',pages:1,passages,warnings };
  }
  if (mime === 'application/pdf') {
    const reader = new PDFParse({ data:new Uint8Array(bytes),isEvalSupported:false,maxImageSize:16_000_000 });
    try {
      const info = await reader.getInfo({ parsePageInfo:true,first:150 });
      const pages = info.total;
      const extraction = await reader.getText({ first:Math.min(150,pages) });
      const passages: PassageDraft[] = [];
      const warnings: string[] = [];
      if (pages > 150) warnings.push('Page limit reached (150)');
      const scanned = extraction.pages.filter(page => !page.text.trim());
      const ocrPages = new Set(scanned.slice(0,12).map(page => page.num));
      if (scanned.length > ocrPages.size) warnings.push('OCR page limit reached (12 textless pages per document)');
      let recognized = 0;
      for (const page of extraction.pages) {
        signal?.throwIfAborted();
        if (page.text.trim()) { passages.push(...split(page.text,page.num)); continue; }
        if (!ocrPages.has(page.num)) continue;
        const dimensions = info.pages.find(item => item.pageNumber === page.num);
        if (!dimensions || !dimensions.width || !dimensions.height) continue;
        const desiredWidth = Math.floor(Math.min(1750,4000 * dimensions.width / dimensions.height));
        if (desiredWidth < 120) { warnings.push('Page ' + page.num + ' has unsupported scan proportions'); continue; }
        try {
          const screenshot = (await reader.getScreenshot({
            partial:[page.num],desiredWidth,imageDataUrl:false,imageBuffer:true,
          })).pages[0];
          if (!screenshot?.data.length) throw new Error('Missing raster image');
          const ocr = await readImageText(Buffer.from(screenshot.data),'image/png',signal);
          const extracted = split(ocr.text,page.num);
          if (!extracted.length) { warnings.push('No recognizable text on scanned page ' + page.num); continue; }
          recognized++;
          passages.push(...extracted);
          warnings.push('Page ' + page.num + ' used OCR. Verify against the original (' + ocr.confidence + '% mean confidence).');
        } catch {
          signal?.throwIfAborted();
          warnings.push('OCR could not read scanned page ' + page.num);
        }
      }
      if (passages.length > 1500) warnings.push('Passage limit reached (1500)');
      return { parser:recognized ? 'pdf-parse+ocr/v1' : 'pdf-parse/v2',pages,passages:passages.slice(0,1500),warnings };
    } finally {
      await reader.destroy();
    }
  }
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replaceAll('\0', '');
  const html = mime === 'text/html' || mime === 'application/xhtml+xml';
  const text = html ? htmlText(raw) : raw;
  const passages = split(text, null);
  const warnings = html ? ['Basic HTML text extraction; layout and tables may be incomplete'] : [];
  if (passages.length > 1500) warnings.push('Passage limit reached (1500)');
  if (!passages.length) warnings.push('No extractable text');
  return { parser: html ? 'html-text/v2' : 'utf8/v1', pages: 0, passages: passages.slice(0,1500), warnings };
}

export function checkUpload(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw invalid('File must be between 1 byte and 8 MiB');
  if (isOffice(mime)) {
    if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50) throw invalid('Use a valid OOXML Office file');
    return;
  }
  if (isImage(mime)) {
    checkImage(bytes,mime);
    return;
  }
  if (mime === 'application/pdf') {
    if (!bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw invalid('File does not contain a PDF header');
  } else {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (text.includes('\0')) throw invalid('Binary text content is unavailable');
    } catch {
      throw invalid('Text uploads require valid UTF-8');
    }
  }
}
