import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Document,Packer,Paragraph } from 'docx';
import PDFDocument from 'pdfkit';
import { zipSync,strToU8 } from 'fflate';
import { officeMime } from '@akw/contracts';
import { checkUpload,parseDocument } from '../src/domain/parsing';

const zip = (files: Record<string,string>) => Buffer.from(zipSync(Object.fromEntries(Object.entries({
  '[Content_Types].xml':'<?xml version="1.0"?><Types/>', ...files,
}).map(([name,xml]) => [name,strToU8(xml)]))));
test('Office extraction preserves text, presentation order and spreadsheet cell positions',async () => {
  const word = await Packer.toBuffer(new Document({ sections:[{ children:[new Paragraph('研究用 Office 文档')] }] }));
  checkUpload(word,officeMime.docx);
  const document = await parseDocument(word,officeMime.docx);
  assert.equal(document.passages[0]?.content,'研究用 Office 文档');
  const presentation = zip({
    'ppt/presentation.xml':'<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId r:id="second"/><p:sldId r:id="first"/></p:sldIdLst></p:presentation>',
    'ppt/_rels/presentation.xml.rels':'<Relationships><Relationship Id="first" Target="slides/slide1.xml"/><Relationship Id="second" Target="slides/slide2.xml"/></Relationships>',
    'ppt/slides/slide1.xml':'<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:t>First physical slide</a:t></a:p></p:sld>',
    'ppt/slides/slide2.xml':'<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:t>First presented slide</a:t></a:p></p:sld>',
  });
  const slides = await parseDocument(presentation,officeMime.pptx);
  assert.equal(slides.pages,2);
  assert.deepEqual(slides.passages.map(item => [item.page,item.content]),[[1,'First presented slide'],[2,'First physical slide']]);
  const workbook = zip({
    'xl/workbook.xml':'<workbook xmlns:r="r"><sheets><sheet name="观察" r:id="main"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="main" Target="/xl/worksheets/sheet7.xml"/></Relationships>',
    'xl/sharedStrings.xml':'<sst><si><t>样本</t></si></sst>',
    'xl/worksheets/sheet7.xml':'<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>17</v></c></row></sheetData></worksheet>',
  });
  const sheets = await parseDocument(workbook,officeMime.xlsx);
  assert.equal(sheets.pages,1);
  assert.equal(sheets.passages.at(-1)?.content,'A1: 样本 | B1: 17');
  assert.equal(sheets.passages.at(-1)?.page,1);
  assert.throws(() => checkUpload(Buffer.from('not zip'),officeMime.docx),/OOXML/);
});
test('PNG OCR uses bundled language data and leaves a quality warning',async () => {
  const image = await readFile('tests/fixtures/ocr-atlas.png');
  const parsed = await parseDocument(image,'image/png');
  assert.equal(parsed.pages,1);
  assert.match(parsed.passages.map(item => item.content).join(' '),/ATLAS 51/i);
  assert.match(parsed.warnings[0] ?? '',/verified against the original/);
});
test('mixed PDF reads the text layer and OCRs the scanned page with its page number',async () => {
  const image = await readFile('tests/fixtures/ocr-atlas.png');
  const pdf = new PDFDocument({ size:'A4' });
  const buffer = new Promise<Buffer>((resolve,reject) => {
    const chunks:Buffer[] = [];
    pdf.on('data',chunk => chunks.push(chunk));
    pdf.on('end',() => resolve(Buffer.concat(chunks)));
    pdf.on('error',reject);
  });
  pdf.text('Searchable first page');
  pdf.addPage().image(image,50,50,{ width:495 });
  pdf.end();
  const result = await parseDocument(await buffer,'application/pdf');
  assert.equal(result.pages,2);
  assert.match(result.passages.filter(item => item.page === 1).map(item => item.content).join(' '),/Searchable first page/);
  assert.match(result.passages.filter(item => item.page === 2).map(item => item.content).join(' '),/ATLAS 51/i);
  assert.ok(result.warnings.some(warning => warning.startsWith('Page 2 used OCR')));
});
