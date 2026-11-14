import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
globalThis.BF = {};
for (const f of ['fonts','hyph','core','specs','layout','cover','export','sample']) require('../src/' + f + '.js');
const BF = globalThis.BF;
const OUT = new URL('./out/', import.meta.url); fs.mkdirSync(OUT, { recursive: true });
const book = BF.sampleBook();
const img = (id, file) => { const bytes = new Uint8Array(fs.readFileSync(new URL(file, import.meta.url))); const i = BF.jpegInfo(bytes); book.images[id] = { id, name: file, type: 'image/jpeg', bytes, w: i.w, h: i.h }; };
img('sample-a', '../examples/images/chapter-opener.jpg'); img('sample-b', '../examples/images/figure.jpg');
const style = process.argv[2] || 'classic';
book.setup.style = style;
if (process.argv[3]) book.setup.trim = process.argv[3];
book.setup.stores = ['kdp','ingram','lulu','d2d','bn','bookvault'];
let t = Date.now();
const lay = BF.layoutBook(book);
console.log('layout ms', Date.now() - t, 'pages', lay.pageCount, 'bodyStart', lay.bodyStart, 'margins', JSON.stringify(lay.geo.mIn), 'missing', [...lay.missing].map(c => String.fromCodePoint(c)).join(''));
t = Date.now(); BF.layoutBook(book); console.log('relayout ms', Date.now() - t);
for (const sid of ['kdp','lulu']) {
  const pdf = await BF.buildInteriorPDF(book, lay, sid);
  fs.writeFileSync(new URL(`interior-${style}-${sid}.pdf`, OUT), pdf);
  const cov = BF.layoutCover(book, sid, lay.pageCount);
  console.log(sid, 'interior bytes', pdf.length, 'cover', (cov.W/72).toFixed(4), 'x', (cov.H/72).toFixed(4), 'spine', cov.spine.w.toFixed(4), cov.spine.source, 'spineText', cov.spineText, JSON.stringify(cov.notes));
  fs.writeFileSync(new URL(`cover-${style}-${sid}.pdf`, OUT), await BF.buildCoverPDF(book, cov));
}
fs.writeFileSync(new URL('book.epub', OUT), await BF.buildEPUB(book, new Uint8Array(fs.readFileSync(new URL('../examples/images/chapter-opener.jpg', import.meta.url)))));
fs.writeFileSync(new URL('book.docx', OUT), await BF.buildDOCX(book, lay.geo));
console.log('done');
