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
book.setup.trim = '6x9';
let n = 0;
for (const [tpl, pages, extra] of [['band', 280, {}], ['classic', 120, { bg: '#f3efe6', fg: '#1b1b1b', accent: '#8a1c1c', titleFont: 'pagella' }], ['split', 400, { frontImage: 'sample-a' }], ['type', 96, { bg: '#0b3d2e', fg: '#f6f1e3', accent: '#f2c14e', spineAccent: true }]]) {
  Object.assign(book.cover, { frontImage: '' }, extra, { template: tpl });
  const cov = BF.layoutCover(book, 'kdp', pages);
  console.log(tpl, pages, (cov.W / 72).toFixed(3), cov.spine.w.toFixed(4), cov.spineText, JSON.stringify(cov.notes));
  fs.writeFileSync(new URL(`cov${++n}.pdf`, OUT), await BF.buildCoverPDF(book, cov));
}
