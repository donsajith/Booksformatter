/* Importers: Markdown / plain text, Word .docx, and an uploaded table of contents. */
(function (G) {
  'use strict';
  const BF = G.BF, uid = () => BF.uid();
  const FRONT = /^(preface|foreword|introduction|prologue|a note|author'?s note|how to use)/i;
  const BACK = /^(about the author|acknowledge?ments?|afterword|appendix|notes|endnotes|bibliography|references|glossary|index|epilogue|also by|resources|further reading)/i;
  const CHAP = /^\s*(chapter|part)\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b\s*[.:–—-]?\s*(.*)$/i;
  const kindOf = t => FRONT.test(t) ? 'front' : BACK.test(t) ? 'back' : 'chapter';
  const newSection = title => { const k = kindOf(title || ''); return { id: uid(), kind: k, title: title || '', subtitle: '', numbered: k === 'chapter', image: null, blocks: [] }; };
  BF.newSection = function (kind, title) { return { id: uid(), kind, title: title || '', subtitle: '', numbered: kind === 'chapter', image: null, blocks: [{ id: uid(), type: 'text', md: '' }] }; };

  class Builder {
    constructor() { this.sections = []; this.cur = null; this.buf = []; }
    sec(title) { this.flush(); this.cur = newSection(title); this.sections.push(this.cur); }
    need() { if (!this.cur) { this.cur = newSection('Chapter 1'); this.cur.title = ''; this.sections.push(this.cur); } }
    flush() { if (this.buf.length) { const md = this.buf.join('\n').replace(/^\n+|\n+$/g, ''); if (md.trim()) { this.need(); this.cur.blocks.push({ id: uid(), type: 'text', md }); } this.buf = []; } }
    text(line) { this.buf.push(line); }
    block(b) { this.flush(); this.need(); this.cur.blocks.push(Object.assign({ id: uid() }, b)); }
    done() { this.flush(); return this.sections.filter(s => s.title || s.blocks.length); }
  }

  BF.importText = function (text, opts) {
    const ph = BF.parseHeader(text), keep = !!(opts && opts.keepPictures), named = [];
    const lines = ph.body.split('\n'), B = new Builder();
    const hasMd = lines.some(l => /^#\s+\S/.test(l));
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]; let m;
      if (!keep && (m = PIC.exec(l.trim()))) { named.push(m[2].split('/').pop()); continue; }
      if (/^```/.test(l)) {
        const info = l.slice(3).trim(), buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        const seg = info.split('|').map(x => x.trim()), look = /^(shaded|outline|dark)$/i.test(seg[2] || '') ? seg[2].toLowerCase() : '';
        B.block({ type: 'prompt', label: seg[0] || 'Prompt', tool: seg[1] || '', text: buf.join('\n'), look }); continue;
      }
      if ((m = /^#\s+(.*)$/.exec(l))) { B.sec(m[1].trim()); continue; }
      if ((m = /^(#{2,4})\s+(.*)$/.exec(l))) { B.block({ type: 'h', level: m[1].length === 2 ? 2 : 3, text: m[2].replace(/\s*#+\s*$/, '').trim() }); continue; }
      if (!hasMd && (m = CHAP.exec(l)) && l.trim().length < 90) {
        let title = m[3].trim();
        if (!title) { let j = i + 1; while (j < lines.length && !lines[j].trim()) j++; if (j < lines.length && lines[j].trim().length < 80 && j - i <= 3) { title = lines[j].trim(); i = j; } }
        B.sec(title || (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() + ' ' + m[2])); continue;
      }
      if (!hasMd && l.trim() && l.trim().length < 60 && (FRONT.test(l.trim()) || BACK.test(l.trim())) && (!lines[i - 1] || !lines[i - 1].trim()) && (!lines[i + 1] || !lines[i + 1].trim())) { B.sec(l.trim()); continue; }
      B.text(l);
    }
    const notes = [];
    if (named.length) notes.push('The text names ' + named.length + ' picture' + (named.length === 1 ? '' : 's') + ' (' + named.slice(0, 6).join(', ') + (named.length > 6 ? ', ...' : '') + '). A text file cannot carry pictures: add each one with "Add image" in its chapter.');
    if (!keep && ph.head && ph.head['cover-image']) notes.push('The header names a cover picture (' + ph.head['cover-image'] + '). Add it under Cover.');
    return { sections: B.done(), images: [], notes, head: ph.head };
  };

  /* ---- manuscript header: "key: value" lines between two --- lines at the very top ---- */
  const PIC = /^!\[([^\]]*)\]\(\s*([^)]+?)\s*\)\s*$/;
  BF.PICTURE_LINE = PIC;
  BF.parseHeader = function (text) {
    const t = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (!/^---[ \t]*\n/.test(t)) return { head: null, body: t };
    const end = t.search(/\n---[ \t]*(\n|$)/);
    if (end < 0) return { head: null, body: t };
    const head = {}; let last = null, bad = 0;
    for (const line of t.slice(t.indexOf('\n') + 1, end).split('\n')) {
      const m = /^([A-Za-z][A-Za-z0-9 _-]*):\s*(.*)$/.exec(line);
      if (m) { last = m[1].trim().toLowerCase().replace(/[ _]+/g, '-'); head[last] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2'); }
      else if (last && /^\s+\S/.test(line)) head[last] += (head[last] ? '\n' : '') + line.trim();
      else if (last && !line.trim()) head[last] += '\n';
      else if (line.trim()) bad++;
    }
    if (!Object.keys(head).length || bad > Object.keys(head).length) return { head: null, body: t };   // a rule line, not a header
    for (const k in head) head[k] = head[k].replace(/\n+$/, '');
    const rest = t.slice(end + 1), nl = rest.indexOf('\n');
    return { head, body: nl < 0 ? '' : rest.slice(nl + 1) };
  };
  const HEAD = {
    meta: { title: 'title', subtitle: 'subtitle', author: 'author', publisher: 'publisher', year: 'year', edition: 'edition', isbn: 'isbnPrint', 'isbn-ebook': 'isbnEbook', language: 'lang', description: 'description', copyright: 'copyrightText' },
    setup: { trim: 'trim', paper: 'paper', style: 'style', 'prompt-box': 'promptLook' },
    front: { dedication: 'dedication', epigraph: 'epigraph', 'epigraph-source': 'epigraphSource', 'contents-title': 'tocTitle' },
    cover: { 'cover-template': 'template', 'cover-color': 'bg', 'cover-text-color': 'fg', 'cover-accent': 'accent', 'back-headline': 'backHeadline', blurb: 'blurb', bio: 'bio' }
  };
  /* Copy header values into the book. Returns notes about lines it did not recognise. */
  BF.applyHeader = function (book, head) {
    const notes = [], yes = v => /^(yes|true|on|1)$/i.test(String(v)), has = k => head[k] != null && head[k] !== '';
    const known = new Set(['stores', 'contents', 'cover-image', 'barcode', 'spine-text']);
    for (const part in HEAD) for (const k in HEAD[part]) { known.add(k); if (has(k)) book[part][HEAD[part][k]] = head[k]; }
    if (has('stores')) book.setup.stores = head.stores.split(/[,\s]+/).filter(Boolean).map(x => x.toLowerCase());
    if (has('contents')) book.front.toc = yes(head.contents);
    if (has('barcode')) book.cover.barcode = yes(head.barcode);
    if (has('spine-text')) book.cover.spineText = yes(head['spine-text']);
    for (const k in head) {
      const m = /^spine-([a-z0-9]+)$/.exec(k);
      if (m && BF.STORES[m[1]] && +head[k] > 0) { book.setup.spineOverride = Object.assign({}, book.setup.spineOverride, { [m[1]]: +head[k] }); continue; }
      if (!known.has(k)) notes.push('Header line "' + k + '" is not one the formatter knows, so it was ignored.');
    }
    return notes;
  };
  /* Problems with the chosen stores, trim, paper, style and cover options. With fix, bad values go back to the defaults. */
  BF.checkSetup = function (book, fix) {
    const d = BF.newBook(), su = book.setup, out = [], hex = /^#[0-9a-f]{6}$/i;
    const bad = (msg, undo) => { out.push(msg + (fix ? ' The default was used instead.' : '')); if (fix) undo(); };
    const unknown = (su.stores || []).filter(id => !BF.STORES[id]);
    if (unknown.length) bad('Unknown store "' + unknown.join('", "') + '". Choose from: ' + BF.STORE_IDS.join(', ') + '.', () => { su.stores = su.stores.filter(id => BF.STORES[id]); if (!su.stores.length) su.stores = d.setup.stores; });
    else if (!(su.stores || []).length) bad('No store is selected.', () => { su.stores = d.setup.stores; });
    if (!BF.TRIMS.some(t => t.id === su.trim)) bad('Unknown trim size "' + su.trim + '". Choose from: ' + BF.TRIMS.map(t => t.id).join(', ') + '.', () => { su.trim = d.setup.trim; });
    if (!BF.PAPERS.some(p => p.id === su.paper)) bad('Unknown paper "' + su.paper + '". Choose from: ' + BF.PAPERS.map(p => p.id).join(', ') + '.', () => { su.paper = d.setup.paper; });
    if (!BF.STYLES[su.style]) bad('Unknown style "' + su.style + '". Choose from: ' + Object.keys(BF.STYLES).join(', ') + '.', () => { su.style = d.setup.style; });
    if (!BF.PROMPT_LOOKS[su.promptLook]) bad('Unknown prompt box look "' + su.promptLook + '". Choose from: ' + Object.keys(BF.PROMPT_LOOKS).join(', ') + '.', () => { su.promptLook = d.setup.promptLook; });
    if (!BF.COVER_TEMPLATES[book.cover.template]) bad('Unknown cover template "' + book.cover.template + '". Choose from: ' + Object.keys(BF.COVER_TEMPLATES).join(', ') + '.', () => { book.cover.template = d.cover.template; });
    for (const [k, label] of [['bg', 'cover-color'], ['fg', 'cover-text-color'], ['accent', 'cover-accent']]) if (!hex.test(book.cover[k])) bad('"' + label + '" must be a colour such as #14213d, not "' + book.cover[k] + '".', () => { book.cover[k] = d.cover[k]; });
    return out;
  };

  /* ---- .docx ---- */
  function mdEscape(t) { return t.replace(/([*`\\])/g, '\\$1'); }
  function runsToMd(runs) {
    const merged = [];
    for (const r of runs) { const p = merged[merged.length - 1]; if (p && p.b === r.b && p.i === r.i) p.t += r.t; else merged.push({ t: r.t, b: r.b, i: r.i }); }
    let out = '';
    for (const r of merged) {
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(r.t), core = mdEscape(m[2]);
      if (!core) { out += r.t; continue; }
      const w = r.b && r.i ? '***' : r.b ? '**' : r.i ? '*' : '';
      out += m[1] + w + core + w + m[3];
    }
    return out;
  }
  BF.importDocx = async function (bytes) {
    const zip = BF.unzip(bytes), notes = [];
    if (!zip['word/document.xml']) throw new Error('This .docx has no document body. Is it a Word document?');
    const xml = async n => zip[n] ? new DOMParser().parseFromString(BF.fromUtf8(await zip[n].bytes()), 'application/xml') : null;
    const doc = await xml('word/document.xml'), sty = await xml('word/styles.xml'), rel = await xml('word/_rels/document.xml.rels'), num = await xml('word/numbering.xml'), core = await xml('docProps/core.xml');
    const A = (el, n) => el.getAttribute('w:' + n) || el.getAttribute(n);
    const kids = (el, tag) => Array.from(el.children).filter(c => c.tagName === tag);
    const first = (el, tag) => el.getElementsByTagName(tag)[0];
    const styleName = {}, styleOutline = {};
    if (sty) for (const s of Array.from(sty.getElementsByTagName('w:style'))) {
      const nm = first(s, 'w:name'); styleName[A(s, 'styleId')] = nm ? (A(nm, 'val') || '').toLowerCase() : '';
      const ol = first(s, 'w:outlineLvl'); if (ol) styleOutline[A(s, 'styleId')] = +A(ol, 'val');
    }
    const relMap = {}; if (rel) for (const r of Array.from(rel.getElementsByTagName('Relationship'))) relMap[r.getAttribute('Id')] = r.getAttribute('Target');
    const numFmt = {};
    if (num) {
      const abs = {}; for (const a of Array.from(num.getElementsByTagName('w:abstractNum'))) { const lv = first(a, 'w:lvl'), nf = lv && first(lv, 'w:numFmt'); abs[A(a, 'abstractNumId')] = nf ? A(nf, 'val') : 'bullet'; }
      for (const n of Array.from(num.getElementsByTagName('w:num'))) { const a = first(n, 'w:abstractNumId'); numFmt[A(n, 'numId')] = a ? abs[A(a, 'val')] : 'bullet'; }
    }
    const B = new Builder(), images = []; let title = '', lastImage = null, code = null, olCount = 0, sawH1 = false;
    const on = (rPr, tag) => { const e = rPr && kids(rPr, tag)[0]; if (!e) return false; const v = A(e, 'val'); return !(v === '0' || v === 'false' || v === 'none'); };
    async function readPara(p) {
      const runs = [], imgs = [];
      const walk = el => {
        for (const c of Array.from(el.children)) {
          const t = c.tagName;
          if (t === 'w:r') {
            const rPr = kids(c, 'w:rPr')[0], b = on(rPr, 'w:b'), i = on(rPr, 'w:i');
            for (const x of Array.from(c.children)) {
              if (x.tagName === 'w:t') runs.push({ t: x.textContent, b, i });
              else if (x.tagName === 'w:tab') runs.push({ t: ' ', b, i });
              else if (x.tagName === 'w:br' && A(x, 'type') !== 'page') runs.push({ t: ' ', b, i });
              else if (x.tagName === 'w:noBreakHyphen') runs.push({ t: '-', b, i });
              else if (x.tagName === 'w:drawing' || x.tagName === 'w:pict') { const bl = x.getElementsByTagName('a:blip')[0] || x.getElementsByTagName('v:imagedata')[0]; const id = bl && (bl.getAttribute('r:embed') || bl.getAttribute('r:id')); if (id) imgs.push(id); }
            }
          } else if (t === 'w:hyperlink' || t === 'w:ins' || t === 'w:smartTag' || t === 'w:sdt' || t === 'w:sdtContent' || t === 'w:fldSimple') walk(c);
        }
      };
      walk(p);
      return { runs, imgs, text: runs.map(r => r.t).join('') };
    }
    async function handle(p) {
      const pPr = kids(p, 'w:pPr')[0], ps = pPr && kids(pPr, 'w:pStyle')[0], sid = ps ? A(ps, 'val') : '', sn = styleName[sid] || '';
      const ol = pPr && kids(pPr, 'w:outlineLvl')[0], numPr = pPr && kids(pPr, 'w:numPr')[0];
      let level = 0; const hm = /^heading (\d)/.exec(sn);
      if (hm) level = +hm[1]; else if (ol) level = +A(ol, 'val') + 1; else if (styleOutline[sid] != null && styleOutline[sid] < 9) level = styleOutline[sid] + 1;
      const { runs, imgs, text } = await readPara(p), plain = text.replace(/\s+/g, ' ').trim();
      const isCode = /code|prompt|preformatted|plain text|macro/.test(sn);
      if (code && !isCode) { B.block({ type: 'prompt', label: 'Prompt', tool: '', text: code.join('\n'), look: '' }); code = null; }
      for (const rid of imgs) {
        const target = relMap[rid], path = target ? 'word/' + target.replace(/^\/?word\//, '').replace(/^\.\.\//, '') : null, ext = path ? path.split('.').pop().toLowerCase() : '';
        if (path && zip[path] && /^(png|jpe?g|gif|webp|bmp)$/.test(ext)) {
          const id = uid(); images.push({ id, name: path.split('/').pop(), type: 'image/' + (ext === 'jpg' ? 'jpeg' : ext), bytes: await zip[path].bytes() });
          B.block({ type: 'image', img: id, caption: '', size: 'full' }); lastImage = B.cur.blocks[B.cur.blocks.length - 1];
        } else notes.push('A picture in an unsupported format (' + (ext || 'unknown') + ') was skipped.');
      }
      if (!plain) { if (!imgs.length) B.text(''); return; }
      if (sn === 'title' && !title) { title = plain; return; }
      if (/caption/.test(sn) && lastImage) { lastImage.caption = plain; lastImage = null; return; }
      lastImage = null;
      if (level === 1) { sawH1 = true; B.sec(plain); return; }
      if (level >= 2) { B.block({ type: 'h', level: level === 2 ? 2 : 3, text: plain }); return; }
      if (isCode) { (code = code || []).push(text); return; }
      if (/^(\*\s*){3}$|^#$|^⁂$|^(-\s*){3}$/.test(plain)) { B.text(''); B.text('* * *'); B.text(''); return; }
      const md = runsToMd(runs).replace(/\s+/g, ' ').trim();
      if (numPr) {
        const nid = first(numPr, 'w:numId'), fmt = nid ? numFmt[A(nid, 'val')] : 'bullet';
        if (fmt && fmt !== 'bullet' && fmt !== 'none') { olCount++; B.text(olCount + '. ' + md); } else { olCount = 0; B.text('- ' + md); }
        return;
      }
      if (olCount) { olCount = 0; B.text(''); }
      if (/quote/.test(sn)) { B.text(''); B.text('> ' + md); B.text(''); return; }
      B.text(''); B.text(md.replace(/^(#{1,4}\s|>|\d{1,3}[.)]\s|[-•]\s)/, '\\$1'));
    }
    async function body(el) {
      for (const c of Array.from(el.children)) {
        if (c.tagName === 'w:p') await handle(c);
        else if (c.tagName === 'w:tbl') {
          notes.push('A table was flattened to text rows. Check it in the editor.');
          for (const tr of Array.from(c.getElementsByTagName('w:tr'))) { const cells = Array.from(tr.getElementsByTagName('w:tc')).map(tc => tc.textContent.replace(/\s+/g, ' ').trim()); B.text(''); B.text(cells.join('  |  ')); }
        } else if (c.tagName === 'w:sdt') { const sc = kids(c, 'w:sdtContent')[0]; if (sc) await body(sc); }
      }
    }
    const bodyEl = doc.getElementsByTagName('w:body')[0];
    if (!bodyEl) throw new Error('Could not read the document body.');
    await body(bodyEl);
    if (code) B.block({ type: 'prompt', label: 'Prompt', tool: '', text: code.join('\n'), look: '' });
    let sections = B.done();
    if (!sawH1) {                       // no Heading 1 styles: fall back to "Chapter N" lines
      const flat = []; for (const s of sections) for (const b of s.blocks) flat.push(b);
      const re = BF.importText(flat.map(b => b.type === 'text' ? b.md : '\u0000' + flat.indexOf(b)).join('\n\n'));
      if (re.sections.length > 1) {
        for (const s of re.sections) { const nb = []; for (const b of s.blocks) { if (b.type !== 'text') { nb.push(b); continue; } const parts = b.md.split(/\n*\u0000(\d+)\n*/); parts.forEach((pt, k) => { if (k % 2) nb.push(flat[+pt]); else if (pt.trim()) nb.push({ id: uid(), type: 'text', md: pt.trim() }); }); } s.blocks = nb; }
        sections = re.sections;
      } else notes.push('No "Heading 1" styles or "Chapter N" lines were found, so the whole document came in as one chapter. Upload a table of contents to split it.');
    }
    const meta = {}; if (title) meta.title = title;
    if (core) { const c = core.getElementsByTagName('dc:creator')[0]; if (c && c.textContent.trim()) meta.author = c.textContent.trim(); const t = core.getElementsByTagName('dc:title')[0]; if (!meta.title && t && t.textContent.trim()) meta.title = t.textContent.trim(); }
    if (doc.getElementsByTagName('w:footnoteReference').length) notes.push('Footnotes are not carried over. Add them as notes at the end of the chapter.');
    return { sections, images, notes: Array.from(new Set(notes)), meta };
  };

  /* ---- table of contents ---- */
  const norm = s => String(s || '').toLowerCase().replace(/^\s*(chapter|part)\s+(\d+|[ivxlcdm]+|[a-z]+)\s*[.:–—-]\s*/i, '').replace(/^\s*\d+(\.\d+)*[.)]?\s+/, '').replace(/[^a-z0-9]+/g, '');
  BF.parseToc = function (text) {
    const out = [];
    for (const raw of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
      if (!raw.trim() || /^\s*(table of\s+)?contents\s*$/i.test(raw)) continue;
      let t = raw.replace(/(\s*[.·…_]{2,}\s*|\t+|\s{2,})(\d+|[ivxlc]+)\s*$/i, '').replace(/[.·…\s]+$/, '');
      const indent = /^(\s*)/.exec(raw)[1].replace(/\t/g, '    ').length, sub = /^\s*\d+\.\d+/.test(t) || /^\s*[-•*]\s+/.test(t);
      let m, title = t.trim().replace(/^[-•*]\s+/, '');
      if ((m = /^(chapter|part)\s+(\d+|[ivxlcdm]+|[a-z]+)\s*[.:–—-]?\s*(.*)$/i.exec(title))) title = m[3].trim() || title;
      else title = title.replace(/^\d+(\.\d+)+[.)]?\s+/, '').replace(/^\d{1,3}[.)]?\s+(?=\S)/, '');
      if (title) out.push({ level: indent >= 2 || sub ? 2 : 1, title });
    }
    if (out.length && out.every(e => e.level === 2)) out.forEach(e => { e.level = 1; });
    return out;
  };
  /* Split loaded text at the TOC's titles; if the text does not contain them, build an empty skeleton. */
  BF.applyToc = function (book, entries) {
    const lines = [];
    for (const s of BF.orderedSections(book)) {
      if (s.title) lines.push({ t: 'title', text: s.title, sec: s });
      for (const b of s.blocks || []) {
        if (b.type === 'text') for (const ln of b.md.split('\n')) lines.push({ t: 'line', text: ln });
        else if (b.type === 'h') lines.push({ t: 'h', text: b.text, blk: b });
        else lines.push({ t: 'blk', blk: b });
      }
    }
    const hasText = lines.some(l => l.t === 'line' && l.text.trim()), l1 = entries.filter(e => e.level === 1);
    const idx = new Map(); entries.forEach(e => { const k = norm(e.title); if (k && !idx.has(k)) idx.set(k, e); });
    let hits = 0; const seen = new Set();
    if (hasText) for (const l of lines) { if (l.t === 'blk') continue; const e = l.text.trim().length < 140 ? idx.get(norm(l.text)) : null; if (e && !seen.has(e)) { l.hit = e; seen.add(e); if (e.level === 1) hits++; } }
    if (!hasText || hits < Math.max(1, Math.ceil(l1.length * 0.5))) {
      if (hasText) return { mode: 'nomatch', matched: hits, total: l1.length };
      const secs = []; let cur = null;
      for (const e of entries) {
        if (e.level === 1 || !cur) { cur = newSection(e.title); secs.push(cur); }
        else cur.blocks.push({ id: uid(), type: 'h', level: 2, text: e.title }, { id: uid(), type: 'text', md: '' });
      }
      for (const s of secs) if (!s.blocks.length) s.blocks.push({ id: uid(), type: 'text', md: '' });
      book.sections = secs; return { mode: 'skeleton', matched: 0, total: l1.length, created: secs.length };
    }
    const B = new Builder(); let pre = null;
    for (const l of lines) {
      if (l.hit && l.hit.level === 1) { B.sec(l.hit.title); continue; }
      if (l.hit && l.hit.level === 2) { B.block({ type: 'h', level: 2, text: l.hit.title }); continue; }
      if (!B.cur) {
        if (l.t === 'title') continue;
        if ((l.t === 'line' && l.text.trim()) || l.t !== 'line') { pre = pre || []; pre.push(l); }
        continue;
      }
      if (l.t === 'title') continue;
      if (l.t === 'line') B.text(l.text); else B.block(l.blk);
    }
    const secs = B.done();
    if (pre && pre.some(l => l.t !== 'line' || l.text.trim().length > 40)) {
      const s = newSection('Opening'); s.kind = 'front'; s.numbered = false; const P = new Builder(); P.cur = s; P.sections.push(s);
      for (const l of pre) { if (l.t === 'line') P.text(l.text); else P.block(l.blk); } P.flush(); secs.unshift(s);
    }
    book.sections = secs;
    return { mode: 'split', matched: hits, total: l1.length, created: secs.length };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
