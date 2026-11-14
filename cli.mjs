#!/usr/bin/env node
/* Booksformatter on the command line: one Markdown manuscript in, store files out.
   Needs Node 18 or later and nothing else. Run `node cli.mjs --help`. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
globalThis.BF = {};
for (const f of ['fonts', 'hyph', 'core', 'specs', 'layout', 'cover', 'export', 'import', 'preflight', 'sample']) require(path.join(HERE, 'src', f + '.js'));
const BF = globalThis.BF;

const HELP = `Booksformatter: print and ebook files from one Markdown manuscript.

Usage
  node cli.mjs <manuscript.md> [options]

Options
  --out <folder>     Where to write the files (default: <title>-files next to the manuscript)
  --stores <list>    Comma-separated: ${BF.STORE_IDS.join(', ')} (default: kdp, ingram)
  --trim <size>      Trim size, e.g. 6x9 (see --list)
  --paper <paper>    ${BF.PAPERS.map(p => p.id).join(' | ')}
  --style <style>    ${Object.keys(BF.STYLES).join(' | ')}
  --title <text>     Book title (overrides the manuscript header)
  --author <text>    Author name
  --isbn <number>    Print ISBN, used for the barcode
  --list             Show every trim size, style, paper and store
  --json             Print the result as JSON (for scripts and AI agents)
  --help             Show this help

The manuscript is Markdown. "# Heading" starts a chapter, "## Heading" a section,
"![Caption](picture.jpg)" places a picture, and a fenced block becomes a prompt box.
Book details go in a header at the top of the file. See docs/MANUSCRIPT-FORMAT.md.`;

function fail(msg) { console.error('Error: ' + msg); process.exit(2); }

/* ---- arguments ---- */
const argv = process.argv.slice(2), opt = {}, files = [];
const VALUE = ['out', 'stores', 'trim', 'paper', 'style', 'title', 'author', 'isbn'], FLAG = ['list', 'json', 'help'];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-h') { opt.help = true; continue; }
  if (!a.startsWith('--')) { files.push(a); continue; }
  const eq = a.indexOf('='), k = a.slice(2, eq < 0 ? undefined : eq);
  if (FLAG.includes(k)) opt[k] = true;
  else if (VALUE.includes(k)) { const v = eq < 0 ? argv[++i] : a.slice(eq + 1); if (v == null) fail('--' + k + ' needs a value.'); opt[k] = v; }
  else fail('Unknown option --' + k + '. Run with --help to see the options.');
}
if (opt.help || (!files.length && !opt.list)) { console.log(HELP); process.exit(opt.help ? 0 : 2); }
if (opt.list) {
  console.log('Trim sizes\n' + BF.TRIMS.map(t => '  ' + t.id.padEnd(12) + t.note).join('\n'));
  console.log('\nInterior styles\n' + Object.entries(BF.STYLES).map(([k, s]) => '  ' + k.padEnd(12) + s.blurb).join('\n'));
  console.log('\nPaper\n' + BF.PAPERS.map(p => '  ' + p.id.padEnd(12) + p.label).join('\n'));
  console.log('\nStores\n' + BF.STORE_IDS.map(id => '  ' + id.padEnd(12) + BF.STORES[id].name).join('\n'));
  console.log('\nCover templates\n' + Object.entries(BF.COVER_TEMPLATES).map(([k, t]) => '  ' + k.padEnd(12) + t.blurb).join('\n'));
  process.exit(0);
}
if (files.length > 1) fail('Give one manuscript file. Got: ' + files.join(', '));
const src = path.resolve(files[0]);
if (!fs.existsSync(src)) fail('Cannot find ' + files[0]);
if (/\.docx$/i.test(src)) fail('Word files are imported in the browser app (index.html). The command line reads Markdown or plain text.');
const baseDir = path.dirname(src);

/* ---- read the manuscript and its header ---- */
const text = fs.readFileSync(src, 'utf8');
const book = BF.newBook(), imported = BF.importText(text, { keepPictures: true }), head = imported.head || {};
const has = k => head[k] != null && head[k] !== '';
const notes = BF.applyHeader(book, head);
if (opt.stores) book.setup.stores = opt.stores.split(/[,\s]+/).filter(Boolean).map(s => s.toLowerCase());
for (const k of ['trim', 'paper', 'style']) if (opt[k]) book.setup[k] = opt[k];
if (opt.title) book.meta.title = opt.title;
if (opt.author) book.meta.author = opt.author;
if (opt.isbn) book.meta.isbnPrint = opt.isbn;
const problems = BF.checkSetup(book, false);
if (problems.length) fail(problems.join('\n       ') + '\n       Run with --list to see every option.');

/* ---- pictures: JPEG files named in the manuscript, read from disk ---- */
const loaded = new Map();
function picture(ref) {
  const file = path.resolve(baseDir, decodeURI(ref));
  if (loaded.has(file)) return loaded.get(file);
  if (!fs.existsSync(file)) fail('Picture not found: ' + ref + ' (looked in ' + baseDir + ')');
  const bytes = new Uint8Array(fs.readFileSync(file)), info = BF.jpegInfo(bytes);
  if (!info) fail(ref + ' is not a JPEG. The command line places JPEG pictures only; convert it, or add it in the browser app.');
  const id = 'img' + (loaded.size + 1);
  book.images[id] = { id, name: path.basename(file), type: 'image/jpeg', bytes, w: info.w, h: info.h, comps: info.comps };
  loaded.set(file, id);
  return id;
}
const PIC = BF.PICTURE_LINE;
book.sections = imported.sections;
if (!book.sections.length) fail('The manuscript has no text.');
for (const sec of book.sections) {
  const out = [];
  for (const blk of sec.blocks) {
    if (blk.type !== 'text') { out.push(blk); continue; }
    let buf = [];
    const flush = () => { const md = buf.join('\n').replace(/^\n+|\n+$/g, ''); if (md.trim()) out.push({ id: BF.uid(), type: 'text', md }); buf = []; };
    for (const line of blk.md.split('\n')) {
      const m = PIC.exec(line.trim());
      if (!m) { buf.push(line); continue; }
      flush();
      const id = picture(m[2]);
      // A picture straight under the "# Heading" line is the chapter's supporting image.
      if (!out.length && !sec.image) sec.image = { id, place: 'above', caption: m[1] };
      else out.push({ id: BF.uid(), type: 'image', img: id, caption: m[1], size: 'full' });
    }
    flush();
  }
  sec.blocks = out;
}
let ebookCover = null;
if (has('cover-image')) {
  const id = picture(head['cover-image']), a = book.images[id];
  book.cover.frontImage = id;
  book.cover.frontImageMode = a.h > a.w * 1.2 ? 'full' : 'top';
  if (book.cover.frontImageMode === 'top' && !has('cover-template')) book.cover.template = 'split';
  if (book.cover.frontImageMode === 'full') ebookCover = a.bytes;
}
if (BF.paper(book.setup.paper).color === false && Object.values(book.images).some(a => a.comps !== 1 && a.id !== book.cover.frontImage))
  notes.push('This is a black-ink interior but some pictures are colour JPEGs. The command line does not convert them: save them as greyscale, or build in the browser app, which converts them for you.');
if (!ebookCover) notes.push('No ebook cover image was written and the EPUB has no cover picture. Give a finished portrait cover with "cover-image:" in the header, or build in the browser app, which draws one.');

/* ---- lay out and write ---- */
const slug = (book.meta.title || path.basename(src).replace(/\.[^.]+$/, '')).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'book';
const outDir = path.resolve(opt.out || path.join(baseDir, slug + '-files'));
fs.mkdirSync(outDir, { recursive: true });
const lay = BF.layoutBook(book), covers = BF.buildCovers(book, lay), checks = BF.preflight(book, lay, covers);
const written = [];
const write = (name, bytes, what) => { fs.writeFileSync(path.join(outDir, name), bytes); written.push({ file: name, what, bytes: bytes.length }); };
const stores = [];
for (const id of BF.activeStores(book.setup)) {
  const S = BF.STORES[id], cov = covers[id];
  write(slug + '-interior-' + id + '.pdf', await BF.buildInteriorPDF(book, lay, id), S.short + ' interior, ' + lay.pageCount + ' pages');
  write(slug + '-cover-' + id + '.pdf', await BF.buildCoverPDF(book, cov), S.short + ' wrap cover, ' + (cov.W / 72).toFixed(3) + ' x ' + (cov.H / 72).toFixed(3) + ' in');
  stores.push({ store: id, name: S.name, spineInches: +cov.spine.w.toFixed(4), spineFrom: cov.spine.source, spineText: !!cov.spineText, coverInches: [+(cov.W / 72).toFixed(3), +(cov.H / 72).toFixed(3)] });
}
write(slug + '.epub', await BF.buildEPUB(book, ebookCover), 'EPUB 3');
write(slug + '.docx', await BF.buildDOCX(book, lay.geo), 'Word document for editors');
if (ebookCover) write(slug + '-ebook-cover.jpg', ebookCover, 'Ebook cover (your picture, unchanged)');
write(slug + '-preflight.txt', Buffer.from(BF.preflightText(book, lay, checks) + (notes.length ? '\nCOMMAND LINE NOTES\n' + notes.map(n => '  [NOTE] ' + n).join('\n') + '\n' : ''), 'utf8'), 'Preflight report');

const count = lv => checks.filter(c => c.level === lv).length;
const result = {
  title: book.meta.title, pages: lay.pageCount, trim: book.setup.trim, paper: book.setup.paper, style: book.setup.style,
  marginsInches: lay.geo.mIn, stores, folder: outDir, files: written,
  preflight: { fix: count('error'), check: count('warn'), items: checks.filter(c => c.level === 'error' || c.level === 'warn').map(c => ({ level: c.level === 'error' ? 'fix' : 'check', where: c.scope, message: c.msg })) },
  notes
};
if (opt.json) console.log(JSON.stringify(result, null, 2));
else {
  const t = BF.trim(book.setup.trim);
  console.log((book.meta.title || 'Untitled') + ': ' + lay.pageCount + ' pages at ' + BF.trimLabel(t) + ', ' + BF.paper(book.setup.paper).label.toLowerCase() + ', ' + BF.STYLES[book.setup.style].label + ' style');
  console.log('Margins (in): inside ' + lay.geo.mIn.inside + ', outside ' + lay.geo.mIn.outside + ', top ' + lay.geo.mIn.top + ', bottom ' + lay.geo.mIn.bottom);
  for (const s of stores) console.log('  ' + s.name.padEnd(22) + 'spine ' + s.spineInches.toFixed(3) + ' in (' + (s.spineFrom === 'formula' ? "store's formula" : s.spineFrom === 'override' ? 'your figure' : 'estimate: confirm on the store') + '), cover ' + s.coverInches[0].toFixed(3) + ' x ' + s.coverInches[1].toFixed(3) + ' in');
  console.log('\nWrote ' + written.length + ' files to ' + outDir);
  for (const f of written) console.log('  ' + f.file.padEnd(Math.max(...written.map(w => w.file.length)) + 2) + f.what);
  console.log('\nPreflight: ' + result.preflight.fix + ' to fix, ' + result.preflight.check + ' to check.');
  for (const i of result.preflight.items) console.log('  [' + i.level.toUpperCase() + '] ' + (i.where === 'book' || i.where === 'ebook' ? '' : BF.STORES[i.where].short + ': ') + i.message);
  for (const n of notes) console.log('  [NOTE] ' + n);
}
process.exit(result.preflight.fix ? 1 : 0);
