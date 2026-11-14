/* The five workbench panes: Manuscript, Setup, Front & back, Cover, Check & export. */
(function () {
  'use strict';
  const BF = window.BF, UI = BF.UI, S = UI.S, h = UI.h, $ = UI.$, IN = 72;
  let dyn = [];
  const ch = now => UI.changed(now);
  const field = (label, control, hint) => h('label', { class: 'field' }, h('span', { class: 'lab', text: label }), control, hint ? h('span', { class: 'hint', text: hint }) : null);
  const input = (id, value, on, attrs) => h('input', Object.assign({ id, type: 'text', value: value == null ? '' : value, oninput: e => on(e.target.value) }, attrs || {}));
  const area = (id, value, on, attrs) => { const t = h('textarea', Object.assign({ id, rows: 3, oninput: e => { on(e.target.value); grow(e.target); } }, attrs || {})); t.value = value || ''; return t; };
  const select = (id, value, opts, on) => h('select', { id, onchange: e => on(e.target.value) }, opts.map(o => h('option', { value: o[0], text: o[1], selected: String(o[0]) === String(value == null ? '' : value) })));
  const check = (id, checked, label, on, hint) => h('label', { class: 'check' }, h('input', { id, type: 'checkbox', checked, onchange: e => on(e.target.checked) }), h('span', null, label, hint ? h('span', { class: 'hint', text: hint }) : null));
  const btn = (text, on, cls, attrs) => h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), text, onclick: on }, attrs || {}));
  const grow = t => { t.style.height = 'auto'; t.style.height = Math.min(2400, t.scrollHeight + 2) + 'px'; };
  const group = (title, ...kids) => h('section', { class: 'group' }, h('h3', { text: title }), kids);
  const tri = v => v == null ? '' : v ? '1' : '0', untri = v => v === '' ? null : v === '1';

  /* ================= Manuscript ================= */
  const hasContent = s => (s.blocks || []).some(b => (b.md || b.text || b.img || '').toString().trim());
  async function applyImport(res, what) {
    let b = S.book, mode = 'replace';
    if (b.sample) { const nb = BF.newBook(); nb.setup = Object.assign(nb.setup, { stores: b.setup.stores }); S.book = b = nb; }
    else if (b.sections.some(hasContent)) {
      mode = await UI.dialog('Import ' + what, h('p', { text: 'This book already has text. Replace it with the imported file, or add the imported chapters after the ones you have?' }), [{ label: 'Cancel', value: null }, { label: 'Add to the end', value: 'append' }, { label: 'Replace', value: 'replace', primary: true }]);
      if (!mode) return;
    }
    if (res.head && mode === 'replace') res.notes = (res.notes || []).concat(BF.applyHeader(b, res.head), BF.checkSetup(b, true));
    let pics = 0;
    for (const im of res.images || []) { try { b.images[im.id] = await UI.makeAsset(im.bytes, im.type, im.name, im.id); pics++; } catch (e) { for (const s of res.sections) s.blocks = s.blocks.filter(x => x.img !== im.id); } }
    if (res.meta) { if (!b.meta.title && res.meta.title) b.meta.title = res.meta.title; if (!b.meta.author && res.meta.author) b.meta.author = res.meta.author; }
    for (const s of res.sections) if (!s.blocks.length) s.blocks.push({ id: BF.uid(), type: 'text', md: '' });
    b.sections = mode === 'append' ? b.sections.concat(res.sections) : res.sections;
    S.sel = res.sections[0] && res.sections[0].id; S.spread = 0; UI.render(); ch(true);
    const words = res.sections.reduce((n, s) => n + s.blocks.reduce((m, x) => m + ((x.md || x.text || '').match(/\S+/g) || []).length, 0), 0);
    const msg = 'Imported ' + res.sections.length + ' section' + (res.sections.length === 1 ? '' : 's') + ', ' + words.toLocaleString() + ' words' + (pics ? ', ' + pics + ' picture' + (pics === 1 ? '' : 's') : '') + '.';
    if (res.notes && res.notes.length) UI.dialog('Import finished', h('div', null, h('p', { text: msg }), h('ul', null, res.notes.map(n => h('li', { text: n })))), [{ label: 'OK', value: true, primary: true }]); else UI.toast(msg, 'good');
  }
  async function importFile(f) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (/\.docx$/i.test(f.name)) await applyImport(await BF.importDocx(bytes), f.name);
      else if (/\.(md|markdown|txt|text)$/i.test(f.name) || /^text\//.test(f.type)) await applyImport(BF.importText(BF.fromUtf8(bytes)), f.name);
      else UI.toast('Use a Word .docx, Markdown .md or plain .txt file. Older .doc files need saving as .docx first.', 'bad');
    } catch (e) { console.error(e); UI.toast('That file could not be imported: ' + e.message, 'bad'); }
  }
  function pickFile(accept, on) { const i = h('input', { type: 'file', accept }); i.onchange = () => i.files[0] && on(i.files[0]); i.click(); }
  async function pasteText() {
    const ta = h('textarea', { id: 'paste-text', rows: 14, placeholder: '# Chapter title\n\nParagraphs separated by blank lines.\n\n## Section heading\n\n```Prompt\nText inside a fenced block becomes a prompt box.\n```' });
    const ok = await UI.dialog('Paste your manuscript', h('div', null, h('p', { text: 'Start each chapter with "# Title" or a line such as "Chapter 3". Use "## " for section headings. Text an AI assistant prepared in the Booksformatter format can be pasted as it is, header included.' }), ta), [{ label: 'Cancel', value: false }, { label: 'Import text', value: true, primary: true }]);
    if (ok && ta.value.trim()) await applyImport(BF.importText(ta.value), 'pasted text');
  }
  async function tocDialog() {
    const ta = h('textarea', { id: 'toc-text', rows: 12, placeholder: 'Introduction\nChapter 1: What a Prompt Really Is ........ 1\n    The four things every brief needs\nChapter 2: Showing Instead of Telling ..... 9' });
    const file = btn('Choose a file (.txt, .md, .docx)', () => pickFile('.txt,.md,.markdown,.docx,text/plain', async f => {
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (/\.docx$/i.test(f.name)) { const r = await BF.importDocx(bytes), L = []; for (const s of r.sections) { if (s.title) L.push(s.title); for (const x of s.blocks) { if (x.type === 'h') L.push('    ' + x.text); else if (x.type === 'text') L.push(...x.md.split('\n').map(t => t.replace(/^[-\d.)\s]+/, m => /^\s{2,}/.test(m) ? m : ''))); } } ta.value = L.filter(t => t.trim()).join('\n'); }
        else ta.value = BF.fromUtf8(bytes);
      } catch (e) { UI.toast('That file could not be read.', 'bad'); }
    }));
    const ok = await UI.dialog('Upload your table of contents', h('div', null, h('p', { text: 'One entry per line. Indent section headings under their chapter. Page numbers and dot leaders are ignored: the formatter works out the real page numbers from the finished layout.' }), file, ta), [{ label: 'Cancel', value: false }, { label: 'Use this contents list', value: true, primary: true }]);
    if (!ok || !ta.value.trim()) return;
    const entries = BF.parseToc(ta.value); if (!entries.length) return UI.toast('No entries were found in that text.', 'bad');
    const b = S.book;
    if (b.sample) { const nb = BF.newBook(); nb.setup = Object.assign(nb.setup, { stores: b.setup.stores }); S.book = nb; }
    const r = BF.applyToc(S.book, entries);
    if (r.mode === 'nomatch') return UI.toast('Only ' + r.matched + ' of ' + r.total + ' chapter titles appear in the manuscript on a line of their own, so nothing was changed.', 'bad');
    if (entries.some(e => e.level === 2)) S.book.front.tocSections = true;
    S.book.front.toc = true; S.sel = S.book.sections[0] && S.book.sections[0].id; UI.render(); ch(true);
    UI.toast(r.mode === 'split' ? 'Split the manuscript into ' + r.created + ' sections (' + r.matched + ' of ' + r.total + ' titles matched).' : 'Created ' + r.created + ' empty chapters from your contents list.', 'good');
  }
  function addSection(kind, title) { const s = BF.newSection(kind, title || ''); S.book.sections.push(s); S.sel = s.id; UI.render(); ch(); const t = $('#sec-title'); if (t) t.focus(); }
  function outline() {
    const b = S.book, nums = BF.chapterNumbers(b), wrap = h('nav', { class: 'outline', 'aria-label': 'Book outline' });
    for (const [kind, label, add, def] of [['front', 'Front matter', 'Add', 'Preface'], ['chapter', 'Chapters', 'Add chapter', ''], ['back', 'Back matter', 'Add', 'About the Author']]) {
      const items = b.sections.filter(s => s.kind === kind);
      wrap.append(h('div', { class: 'ol-head' }, h('span', { text: label }), h('button', { type: 'button', class: 'link', text: '+ ' + add, onclick: () => addSection(kind, def) })));
      if (!items.length) wrap.append(h('p', { class: 'ol-empty', text: kind === 'chapter' ? 'No chapters yet' : 'None' }));
      for (const s of items) wrap.append(h('button', { type: 'button', class: 'ol-item' + (s.id === S.sel ? ' on' : ''), onclick: () => { S.sel = s.id; UI.render(); UI.showSection(s.id); } }, h('span', { class: 'ol-num', text: nums.get(s.id) || '·' }), h('span', { class: 'ol-title', text: s.title || 'Untitled' })));
    }
    return wrap;
  }
  function moveSection(sec, d) { const all = S.book.sections, same = all.filter(s => s.kind === sec.kind), i = same.indexOf(sec), o = same[i + d]; if (!o) return; const a = all.indexOf(sec), c = all.indexOf(o); all[a] = o; all[c] = sec; UI.render(); ch(); }
  function dpiNote(el, imgId) { dyn.push(() => { const a = S.book.images[imgId], p = S.lay && S.lay.placed.filter(x => x.id === imgId).sort((m, n) => n.w - m.w)[0]; if (!a) { el.textContent = ''; return; } if (!p) { el.textContent = a.w + ' × ' + a.h + ' px'; el.className = 'dpi'; return; } const d = Math.round(Math.min(a.w / (p.w / IN), a.h / (p.h / IN))); el.textContent = a.w + ' × ' + a.h + ' px, prints at ' + d + ' dpi'; el.className = 'dpi ' + (d < 150 ? 'bad' : d < 295 ? 'warn' : 'good'); }); }
  function insertMenu(sec, idx, open) {
    const add = async type => {
      let blk;
      if (type === 'text') blk = { type: 'text', md: '' };
      else if (type === 'h') blk = { type: 'h', level: 2, text: '' };
      else if (type === 'prompt') blk = { type: 'prompt', label: 'Prompt', tool: '', text: '', look: '' };
      else if (type === 'break') blk = { type: 'break' };
      else { const id = await UI.pickImage(); if (!id) return; blk = { type: 'image', img: id, caption: '', size: 'full' }; }
      blk.id = BF.uid(); sec.blocks.splice(idx, 0, blk); UI.render(); ch();
      const el = document.querySelector('[data-blk="' + blk.id + '"] textarea, [data-blk="' + blk.id + '"] input'); if (el) el.focus();
    };
    return h('div', { class: 'ins' + (open ? ' open' : '') }, h('span', { class: 'ins-lab', text: open ? 'Add to this ' + (sec.kind === 'chapter' ? 'chapter' : 'section') : 'Add here' }),
      btn('Text', () => add('text'), 'mini'), btn('Section heading', () => add('h'), 'mini'), btn('Image', () => add('image'), 'mini'), btn('Prompt box', () => add('prompt'), 'mini'), btn('Page break', () => add('break'), 'mini'));
  }
  function blockCard(sec, blk, idx) {
    const up = () => { if (idx > 0) { sec.blocks.splice(idx - 1, 0, sec.blocks.splice(idx, 1)[0]); UI.render(); ch(); } };
    const down = () => { if (idx < sec.blocks.length - 1) { sec.blocks.splice(idx + 1, 0, sec.blocks.splice(idx, 1)[0]); UI.render(); ch(); } };
    const del = () => { sec.blocks.splice(idx, 1); UI.render(); ch(); };
    const tools = h('div', { class: 'blk-tools' }, btn('↑', up, 'icon', { 'aria-label': 'Move up', disabled: idx === 0 }), btn('↓', down, 'icon', { 'aria-label': 'Move down', disabled: idx === sec.blocks.length - 1 }), btn('×', del, 'icon', { 'aria-label': 'Delete this block' }));
    const names = { text: 'Text', h: 'Section heading', image: 'Image', prompt: 'Prompt box', break: 'Page break' };
    const card = h('div', { class: 'blk blk-' + blk.type, 'data-blk': blk.id }, h('div', { class: 'blk-head' }, h('span', { class: 'blk-kind', text: names[blk.type] }), tools));
    if (blk.type === 'text') card.append(area('t-' + blk.id, blk.md, v => { blk.md = v; ch(); }, { class: 'prose', 'aria-label': 'Text', placeholder: 'Type or paste text. Leave a blank line between paragraphs.' }));
    else if (blk.type === 'h') {
      const endOfSection = () => { let j = idx + 1; while (j < sec.blocks.length && !(sec.blocks[j].type === 'h' && (sec.blocks[j].level || 2) <= (blk.level || 2))) j++; return j; };
      card.append(h('div', { class: 'row' }, input('h-' + blk.id, blk.text, v => { blk.text = v; ch(); }, { class: 'grow strong', 'aria-label': 'Section heading', placeholder: 'Section heading' }), select('hl-' + blk.id, blk.level || 2, [[2, 'Section'], [3, 'Sub-section']], v => { blk.level = +v; ch(); })),
        h('div', { class: 'row sec-add' }, btn('Add image to this section', async () => { const id = await UI.pickImage(); if (!id) return; sec.blocks.splice(endOfSection(), 0, { id: BF.uid(), type: 'image', img: id, caption: '', size: 'full' }); UI.render(); ch(); }, 'mini'),
          btn('Add prompt box to this section', () => { const nb = { id: BF.uid(), type: 'prompt', label: 'Prompt', tool: '', text: '', look: '' }; sec.blocks.splice(endOfSection(), 0, nb); UI.render(); ch(); const el = document.querySelector('[data-blk="' + nb.id + '"] textarea'); if (el) el.focus(); }, 'mini')));
    } else if (blk.type === 'image') {
      const a = S.book.images[blk.img], note = h('span', { class: 'dpi' }); dpiNote(note, blk.img);
      card.append(h('div', { class: 'img-row' }, a ? h('img', { class: 'thumb', src: a.url, alt: '' }) : h('div', { class: 'thumb missing', text: 'Missing' }),
        h('div', { class: 'img-meta' }, h('div', { class: 'img-name', text: a ? a.name : 'Image not in project' }), note,
          h('div', { class: 'row' }, field('Width', select('is-' + blk.id, blk.size || 'full', [['full', 'Full text width'], ['large', 'Large (80%)'], ['medium', 'Medium (60%)'], ['small', 'Small (40%)']], v => { blk.size = v; ch(); })), btn('Replace', async () => { const id = await UI.pickImage(); if (id) { blk.img = id; UI.render(); ch(); } }, 'mini')),
          field('Caption', input('ic-' + blk.id, blk.caption, v => { blk.caption = v; ch(); }, { placeholder: 'Optional' })))));
    } else if (blk.type === 'prompt') {
      card.append(h('div', { class: 'row' }, field('Label', input('pl-' + blk.id, blk.label, v => { blk.label = v; ch(); }, { list: 'prompt-labels' })), field('Tool or model (optional)', input('pt-' + blk.id, blk.tool, v => { blk.tool = v; ch(); }, { placeholder: 'e.g. Runway, 6 seconds' })),
        field('Look', select('pk-' + blk.id, blk.look || '', [['', 'Book default']].concat(Object.entries(BF.PROMPT_LOOKS)), v => { blk.look = v; ch(); }))),
        area('p-' + blk.id, blk.text, v => { blk.text = v; ch(); }, { class: 'mono', 'aria-label': 'Prompt text', placeholder: 'Paste the prompt exactly as it should be typed. Line breaks and straight quotes are kept as they are.', spellcheck: 'false' }));
    } else card.append(h('p', { class: 'hint', text: 'The text after this starts on a new page.' }));
    return card;
  }
  function editor(sec) {
    const b = S.book, wrap = h('div', { class: 'editor' }), ci = sec.image && sec.image.id && b.images[sec.image.id] ? sec.image : null;
    wrap.append(h('div', { class: 'sec-head' },
      input('sec-title', sec.title, v => { sec.title = v; const o = document.querySelector('.ol-item.on .ol-title'); if (o) o.textContent = v || 'Untitled'; ch(); }, { class: 'title-input', placeholder: sec.kind === 'chapter' ? 'Chapter title' : 'Section title', 'aria-label': 'Title' }),
      input('sec-sub', sec.subtitle, v => { sec.subtitle = v; ch(); }, { placeholder: 'Subtitle (optional)', 'aria-label': 'Subtitle' }),
      h('div', { class: 'row wrap' }, field('Part of the book', select('sec-kind', sec.kind, [['front', 'Front matter'], ['chapter', 'Chapter'], ['back', 'Back matter']], v => { sec.kind = v; sec.numbered = v === 'chapter'; UI.render(); ch(); })),
        sec.kind === 'chapter' ? check('sec-num', sec.numbered !== false, 'Numbered', v => { sec.numbered = v; UI.render(); ch(); }) : null,
        h('span', { class: 'spacer' }), btn('↑', () => moveSection(sec, -1), 'icon', { 'aria-label': 'Move earlier' }), btn('↓', () => moveSection(sec, 1), 'icon', { 'aria-label': 'Move later' }),
        btn('Show in proof', () => UI.showSection(sec.id), 'mini'),
        btn('Delete', async () => { if (await UI.confirm('Delete "' + (sec.title || 'Untitled') + '"?', 'Its text, images and prompt boxes are removed from the book.', 'Delete')) { b.sections.splice(b.sections.indexOf(sec), 1); S.sel = null; UI.render(); ch(); } }, 'mini danger'))));
    const imgCard = h('div', { class: 'chap-img' });
    if (ci) {
      const a = b.images[ci.id], note = h('span', { class: 'dpi' }); dpiNote(note, ci.id);
      imgCard.append(h('img', { class: 'thumb', src: a.url, alt: '' }), h('div', { class: 'img-meta' }, h('div', { class: 'img-name', text: (sec.kind === 'chapter' ? 'Chapter' : 'Section') + ' image: ' + a.name }), note,
        h('div', { class: 'row' }, field('Position', select('ci-place', ci.place || 'above', [['above', 'Above the title'], ['below', 'Below the title'], ['full', 'Full page before the chapter']], v => { ci.place = v; ch(); })),
          btn('Replace', async () => { const id = await UI.pickImage(); if (id) { ci.id = id; UI.render(); ch(); } }, 'mini'), btn('Remove', () => { sec.image = null; UI.render(); ch(); }, 'mini')),
        (ci.place || 'above') === 'full' ? null : field('Caption', input('ci-cap', ci.caption, v => { ci.caption = v; ch(); }, { placeholder: 'Optional' }))));
    } else imgCard.append(h('div', { class: 'chap-img-empty' }, h('span', { text: 'Supporting image for this ' + (sec.kind === 'chapter' ? 'chapter' : 'section') }), btn('Add image', async () => { const id = await UI.pickImage(); if (id) { sec.image = { id, place: 'above', caption: '' }; UI.render(); ch(); } }, 'mini')));
    wrap.append(imgCard);
    const list = h('div', { class: 'blocks' });
    sec.blocks.forEach((blk, i) => { list.append(blockCard(sec, blk, i)); if (i < sec.blocks.length - 1) list.append(insertMenu(sec, i + 1, false)); });
    wrap.append(list, insertMenu(sec, sec.blocks.length, true),
      h('p', { class: 'hint md-help', html: 'In text: blank line = new paragraph &middot; <code>*italic*</code> <code>**bold**</code> <code>`code`</code> &middot; <code>- item</code> or <code>1. item</code> for lists &middot; <code>&gt; quote</code> &middot; <code>***</code> scene break &middot; <code>===</code> page break' }));
    return wrap;
  }
  function paneManuscript() {
    const b = S.book, ord = BF.orderedSections(b);
    if (!b.sections.find(s => s.id === S.sel)) S.sel = ord[0] ? ord[0].id : null;
    const sec = b.sections.find(s => s.id === S.sel);
    return h('div', { class: 'ms' },
      h('div', { class: 'import-bar' }, btn('Import manuscript', () => pickFile('.docx,.md,.markdown,.txt,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document', importFile), 'primary'), btn('Paste text', pasteText), btn('Upload table of contents', tocDialog),
        h('span', { class: 'hint', text: 'Word .docx (Heading 1 = chapter, Heading 2 = section, pictures included), Markdown or plain text.' })),
      h('div', { class: 'ms-grid' }, outline(), sec ? editor(sec) : h('div', { class: 'editor empty' }, h('p', { text: 'This book has no sections yet. Import a manuscript, paste text, upload your table of contents to build the chapter list, or add a chapter by hand.' }), btn('Add a chapter', () => addSection('chapter', '')))));
  }

  /* ================= Setup ================= */
  function paneSetup() {
    const b = S.book, su = b.setup, t = BF.trim(su.trim);
    const stores = h('div', { class: 'chips' }, BF.STORE_IDS.map(id => { const Sx = BF.STORES[id], on = su.stores.includes(id); return h('label', { class: 'chip' + (on ? ' on' : '') }, h('input', { id: 'st-' + id, type: 'checkbox', checked: on, onchange: e => { su.stores = BF.STORE_IDS.filter(x => x === id ? e.target.checked : su.stores.includes(x)); UI.render(); ch(true); } }), h('span', { text: Sx.name })); }));
    const avail = h('p', { class: 'hint' }); dyn.push(() => { const tt = BF.trim(su.trim); const yes = BF.STORE_IDS.filter(id => BF.STORES[id].trims.includes(tt.id)).map(id => BF.STORES[id].short); avail.textContent = 'Offered by: ' + yes.join(', ') + '.'; });
    const styles = h('div', { class: 'cards' }, Object.entries(BF.STYLES).map(([id, st]) => {
      BF.getFont(BF.fontKey(st.body, false, false)); BF.getFont(BF.fontKey(st.head, st.ch.titleB, false));
      return h('label', { class: 'card' + (su.style === id ? ' on' : '') }, h('input', { type: 'radio', name: 'style', id: 'style-' + id, checked: su.style === id, onchange: () => { su.style = id; su.bodyFont = ''; su.headFont = ''; su.bodySize = ''; su.leading = ''; su.para = ''; su.justify = null; su.hyphenate = null; su.initial = null; UI.render(); ch(true); } }),
        h('span', { class: 'specimen', style: 'font-family:"BF-' + BF.fontKey(st.head, st.ch.titleB, false) + '",serif', text: st.label }), h('span', { class: 'specimen-body', style: 'font-family:"BF-' + BF.fontKey(st.body, false, false) + '",serif', text: st.blurb }));
    }));
    const st = BF.resolveStyle(su), fams = Object.entries(BF.FONT_FAMILIES).map(([k, v]) => [k, v.label]);
    const mread = h('p', { class: 'readline' }); dyn.push(() => { if (!S.lay) return; const m = S.lay.geo.mIn, need = S.lay.geo.need; mread.textContent = 'Inside ' + m.inside.toFixed(2) + ' · outside ' + m.outside.toFixed(2) + ' · top ' + m.top.toFixed(2) + ' · bottom ' + m.bottom.toFixed(2) + ' in.  Smallest gutter the selected stores accept at ' + S.lay.pageCount + ' pages: ' + need.inside.toFixed(3) + ' in.'; });
    const cm = su.customMargins;
    const marg = h('div', null,
      h('div', { class: 'row wrap' }, h('label', { class: 'check' }, h('input', { type: 'radio', name: 'mm', id: 'mm-auto', checked: !cm, onchange: () => { su.customMargins = null; UI.render(); ch(true); } }), h('span', { text: 'Work them out for me' })),
        h('label', { class: 'check' }, h('input', { type: 'radio', name: 'mm', id: 'mm-own', checked: !!cm, onchange: () => { su.customMargins = Object.assign({}, S.lay ? S.lay.geo.mIn : { top: 0.85, bottom: 0.9, inside: 0.8, outside: 0.625 }); UI.render(); ch(true); } }), h('span', { text: 'I will set them' }))),
      cm ? h('div', { class: 'row wrap' }, ['inside', 'outside', 'top', 'bottom'].map(k => field(k[0].toUpperCase() + k.slice(1) + ' (in)', input('m-' + k, cm[k], v => { cm[k] = parseFloat(v) || 0; ch(); }, { type: 'number', step: '0.01', min: '0.25', max: '2' }))))
        : field('Margin size', select('comfort', su.comfort || 'standard', [['compact', 'Compact (fewer pages)'], ['standard', 'Standard'], ['generous', 'Generous']], v => { su.comfort = v; ch(true); })),
      mread);
    return h('div', { class: 'form' },
      group('Where you will publish', stores, h('p', { class: 'hint', text: 'Each store gets its own interior and cover PDF, because bleed and spine width differ. The EPUB and Word file are shared.' })),
      group('Trim size and paper', h('div', { class: 'row wrap' }, field('Trim size', select('trim', su.trim, BF.TRIMS.map(x => [x.id, BF.trimLabel(x) + '  —  ' + x.note]), v => { su.trim = v; ch(true); })), field('Paper and ink', select('paper', su.paper, BF.PAPERS.map(p => [p.id, p.label]), v => { su.paper = v; ch(true); }))), avail),
      group('Interior style', styles,
        h('details', { class: 'more' }, h('summary', { text: 'Fine-tune the type' }),
          h('div', { class: 'row wrap' }, field('Body font', select('bodyFont', su.bodyFont || '', [['', 'Style default (' + BF.FONT_FAMILIES[BF.STYLES[su.style].body].label.split(' (')[0] + ')']].concat(fams), v => { su.bodyFont = v; ch(true); })), field('Heading font', select('headFont', su.headFont || '', [['', 'Style default (' + BF.FONT_FAMILIES[BF.STYLES[su.style].head].label.split(' (')[0] + ')']].concat(fams), v => { su.headFont = v; ch(true); }))),
          h('div', { class: 'row wrap' }, field('Body size (pt)', input('bodySize', su.bodySize || '', v => { const n = parseFloat(v); su.bodySize = n >= 7 && n <= 16 ? n : ''; ch(); }, { type: 'number', step: '0.5', min: '7', max: '16', placeholder: String(st.size) })), field('Line spacing', input('leading', su.leading || '', v => { const n = parseFloat(v); su.leading = n >= 1.1 && n <= 2 ? n : ''; ch(); }, { type: 'number', step: '0.05', min: '1.1', max: '2', placeholder: String(BF.STYLES[su.style].lead) })),
            field('Paragraphs', select('para', su.para || '', [['', 'Style default'], ['indent', 'First-line indent'], ['block', 'Space between']], v => { su.para = v; ch(true); }))),
          h('div', { class: 'row wrap' }, field('Justified text', select('justify', tri(su.justify), [['', 'Style default'], ['1', 'Justified'], ['0', 'Ragged right']], v => { su.justify = untri(v); ch(true); })), field('Hyphenation', select('hyph', tri(su.hyphenate), [['', 'Style default'], ['1', 'On'], ['0', 'Off']], v => { su.hyphenate = untri(v); ch(true); })), field('Raised first letter', select('initial', tri(su.initial), [['', 'Style default'], ['1', 'On'], ['0', 'Off']], v => { su.initial = untri(v); ch(true); }))),
          check('smart', su.smart !== false, 'Curl quotes and turn -- into dashes', v => { su.smart = v; ch(true); }, 'Prompt boxes are never changed.'))),
      group('Pages', h('div', { class: 'row wrap' }, field('Chapters start', select('chapterStart', su.chapterStart || 'recto', [['recto', 'On a right-hand page'], ['any', 'On the next page']], v => { su.chapterStart = v; ch(true); })), field('Prompt boxes', select('promptLook', su.promptLook || 'shaded', Object.entries(BF.PROMPT_LOOKS), v => { su.promptLook = v; ch(true); }))),
        check('runHeads', su.runHeads !== false, 'Running heads (book title left, chapter title right)', v => { su.runHeads = v; ch(true); }),
        check('fullBleed', !!su.fullBleed, 'Full-page chapter images run off the edge', v => { su.fullBleed = v; ch(true); }, 'Adds bleed to every interior PDF, as the stores require when anything touches the trim.')),
      group('Margins and gutter', marg));
  }

  /* ================= Front & back ================= */
  function paneMatter() {
    const b = S.book, m = b.meta, f = b.front, t = (id, key, label, attrs, hint) => field(label, input(id, m[key], v => { m[key] = v; ch(); }, attrs), hint);
    const cr = area('copyrightText', m.copyrightText || BF.defaultCopyright(m), v => { m.copyrightText = v; ch(); }, { rows: 7 });
    return h('div', { class: 'form' },
      group('Book details', t('m-title', 'title', 'Title'), t('m-sub', 'subtitle', 'Subtitle'), h('div', { class: 'row wrap' }, t('m-author', 'author', 'Author'), t('m-pub', 'publisher', 'Publisher or imprint')),
        h('div', { class: 'row wrap' }, t('m-year', 'year', 'Year', { inputmode: 'numeric' }), t('m-ed', 'edition', 'Edition'), t('m-lang', 'lang', 'Language code', { placeholder: 'en' })),
        h('div', { class: 'row wrap' }, t('m-isbn', 'isbnPrint', 'Print ISBN', { placeholder: '978-…' }, 'Drawn as the barcode on the back cover.'), t('m-eisbn', 'isbnEbook', 'Ebook ISBN (optional)', { placeholder: '978-…' }, 'Must differ from the print ISBN.')),
        field('Description', area('m-desc', m.description, v => { m.description = v; ch(); }, { rows: 3 }), 'Stored in the EPUB. Not printed.')),
      group('Front matter',
        check('f-half', !!f.halfTitle, 'Half-title page', v => { f.halfTitle = v; ch(true); }), check('f-title', f.titlePage !== false, 'Title page', v => { f.titlePage = v; ch(true); }),
        check('f-copy', f.copyright !== false, 'Copyright page', v => { f.copyright = v; UI.render(); ch(true); }),
        f.copyright !== false ? h('div', null, cr, btn('Reset to standard wording', () => { m.copyrightText = ''; UI.render(); ch(); }, 'mini')) : null,
        field('Dedication', area('f-ded', f.dedication, v => { f.dedication = v; ch(); }, { rows: 2, placeholder: 'Leave empty for none' })),
        field('Epigraph', area('f-epi', f.epigraph, v => { f.epigraph = v; ch(); }, { rows: 2, placeholder: 'A quotation that opens the book. Leave empty for none.' })),
        field('Epigraph source', input('f-epis', f.epigraphSource, v => { f.epigraphSource = v; ch(); }))),
      group('Table of contents',
        check('f-toc', f.toc !== false, 'Include a table of contents', v => { f.toc = v; ch(true); }, 'Page numbers are filled in from the finished layout, and the EPUB gets linked navigation.'),
        h('div', { class: 'row wrap' }, field('Heading', input('f-toct', f.tocTitle, v => { f.tocTitle = v; ch(); })), check('f-tocs', !!f.tocSections, 'List section headings under each chapter', v => { f.tocSections = v; ch(true); })),
        h('div', { class: 'row' }, btn('Upload table of contents', tocDialog), h('span', { class: 'hint', text: 'Have a contents list already? Upload it to build the chapter structure or to split a manuscript that has no heading styles.' }))),
      group('Titled front and back sections', h('p', { class: 'hint', text: 'Forewords, prefaces, acknowledgments and the author page are sections of the manuscript, set in the same style as the chapters.' }),
        h('div', { class: 'row wrap' }, ['Foreword', 'Preface', 'Introduction'].map(n => btn('+ ' + n, () => { S.tab = 'manuscript'; addSection('front', n); }, 'mini')), ['Acknowledgments', 'About the Author', 'Also by the Author', 'Notes'].map(n => btn('+ ' + n, () => { S.tab = 'manuscript'; addSection('back', n); }, 'mini')))));
  }

  /* ================= Cover ================= */
  function color(id, key, label) {
    const c = S.book.cover, pick = h('input', { type: 'color', id: id + '-p', value: c[key], 'aria-label': label + ' colour', oninput: e => { c[key] = e.target.value; txt.value = e.target.value; ch(); } });
    const txt = input(id, c[key], v => { if (/^#[0-9a-f]{6}$/i.test(v)) { c[key] = v; pick.value = v; ch(); } }, { class: 'hex', maxlength: '7', 'aria-label': label + ' hex value' });
    return h('div', { class: 'field' }, h('span', { class: 'lab', text: label }), h('div', { class: 'row tight' }, pick, txt));
  }
  function paneCover() {
    const b = S.book, c = b.cover, su = b.setup, fams = Object.entries(BF.FONT_FAMILIES).map(([k, v]) => [k, v.label]), fi = c.frontImage && b.images[c.frontImage];
    const words = h('span', { class: 'hint' }), wc = () => { words.textContent = ((c.blurb || '').match(/\S+/g) || []).length + ' words'; }; wc();
    const table = h('div', { class: 'spine-table' });
    dyn.push(() => {
      table.innerHTML = ''; if (!S.lay) return;
      table.append(h('div', { class: 'srow head' }, h('span', { text: 'Store' }), h('span', { text: 'Spine at ' + S.lay.pageCount + ' pages' }), h('span', { text: 'Your figure (in)' })));
      for (const id of BF.activeStores(su)) {
        const Sx = BF.STORES[id], calc = Sx.spine(S.lay.pageCount, su.paper);
        table.append(h('div', { class: 'srow' }, h('span', null, Sx.name), h('span', { class: 'num' }, calc.toFixed(3) + ' in ', h('span', { class: 'pill ' + (Sx.exact ? 'good' : 'warn'), text: Sx.exact ? 'published formula' : 'estimate' })),
          h('span', null, input('sp-' + id, (su.spineOverride || {})[id] || '', v => { su.spineOverride = su.spineOverride || {}; const n = parseFloat(v); if (n > 0) su.spineOverride[id] = n; else delete su.spineOverride[id]; ch(); }, { type: 'number', step: '0.001', min: '0', placeholder: Sx.exact ? 'not needed' : 'from its template', 'aria-label': Sx.name + ' spine width in inches' }), ' ', h('a', { href: Sx.template, target: '_blank', rel: 'noopener', text: 'template' }))));
      }
    });
    return h('div', { class: 'form' },
      group('Front cover', h('div', { class: 'cards small' }, Object.entries(BF.COVER_TEMPLATES).map(([id, t]) => h('label', { class: 'card' + (c.template === id ? ' on' : '') }, h('input', { type: 'radio', name: 'ctpl', id: 'ctpl-' + id, checked: c.template === id, onchange: () => { c.template = id; UI.render(); ch(true); } }), h('span', { class: 'specimen', text: t.label }), h('span', { class: 'specimen-body', text: t.blurb })))),
        h('div', { class: 'row wrap' }, color('c-bg', 'bg', 'Background'), color('c-fg', 'fg', 'Text'), color('c-ac', 'accent', 'Accent'), field('Title font', select('c-tf', c.titleFont, fams, v => { c.titleFont = v; ch(true); }))),
        h('div', { class: 'chap-img' }, fi ? [h('img', { class: 'thumb', src: fi.url, alt: '' }), h('div', { class: 'img-meta' }, h('div', { class: 'img-name', text: 'Front picture: ' + fi.name + ' (' + fi.w + ' × ' + fi.h + ' px)' }),
          h('div', { class: 'row' }, field('Use it as', select('c-fim', c.frontImageMode + (c.overlayText ? '+t' : ''), [['top', 'Top panel (Split template)'], ['full', 'Finished cover art, no text added'], ['full+t', 'Background, with my title on top']], v => { c.frontImageMode = v.replace('+t', ''); c.overlayText = /\+t/.test(v); if (c.frontImageMode === 'top') c.template = 'split'; UI.render(); ch(true); })), btn('Remove', () => { c.frontImage = ''; UI.render(); ch(true); }, 'mini')))]
          : h('div', { class: 'chap-img-empty' }, h('span', { text: 'Front-cover picture or finished cover art (optional)' }), btn('Add picture', async () => { const id = await UI.pickImage(); if (id) { c.frontImage = id; const a = b.images[id]; c.frontImageMode = a.h > a.w * 1.2 ? 'full' : 'top'; if (c.frontImageMode === 'top') c.template = 'split'; UI.render(); ch(true); } }, 'mini')))),
      group('Back cover', field('Headline', input('c-head', c.backHeadline, v => { c.backHeadline = v; ch(); })), field('Blurb', area('c-blurb', c.blurb, v => { c.blurb = v; wc(); ch(); }, { rows: 6 }), null), words,
        field('About the author (short)', area('c-bio', c.bio, v => { c.bio = v; ch(); }, { rows: 2 })), field('Back text font', select('c-bf', c.backFont, fams, v => { c.backFont = v; ch(true); })),
        check('c-bar', c.barcode !== false, 'Barcode box, lower corner by the spine', v => { c.barcode = v; ch(true); }, 'With a print ISBN the EAN-13 barcode is drawn in it. Without one the box is left clear for stores that print their own.')),
      group('Spine', check('c-st', c.spineText !== false, 'Title and author on the spine', v => { c.spineText = v; ch(true); }, 'Left off automatically when the book is too thin for the store to allow it.'), check('c-sa', !!c.spineAccent, 'Spine in the accent colour', v => { c.spineAccent = v; ch(true); }),
        h('p', { class: 'hint', text: 'Spine width comes from the page count and each store’s paper. Where a store publishes no formula the figure is an estimate: enter the width from that store’s cover template and the cover is rebuilt to it.' }), table));
  }

  /* ================= Check & export ================= */
  function preflightList() {
    const b = S.book, wrap = h('div', { class: 'pf' }), items = S.pre, lv = { error: ['bad', 'Fix'], warn: ['warn', 'Check'], info: ['info', 'Note'], pass: ['good', 'OK'] };
    const groups = [['book', 'The book']].concat(BF.activeStores(b.setup).map(id => [id, BF.STORES[id].name]), [['ebook', 'Ebook']]);
    for (const [g, label] of groups) {
      const its = items.filter(i => i.scope === g).sort((x, y) => ['error', 'warn', 'info', 'pass'].indexOf(x.level) - ['error', 'warn', 'info', 'pass'].indexOf(y.level)); if (!its.length) continue;
      const e = its.filter(i => i.level === 'error').length, w = its.filter(i => i.level === 'warn').length;
      wrap.append(h('div', { class: 'pf-group' }, h('h4', null, label, ' ', h('span', { class: 'pill ' + (e ? 'bad' : w ? 'warn' : 'good'), text: e ? e + ' to fix' : w ? w + ' to check' : 'ready' })),
        h('ul', null, its.map(i => h('li', { class: 'pf-item ' + lv[i.level][0] }, h('span', { class: 'pill ' + lv[i.level][0], text: lv[i.level][1] }), h('span', { class: 'pf-msg', text: i.msg }), i.tab && i.level !== 'pass' ? h('button', { type: 'button', class: 'link', text: 'Go to ' + TABS.find(t => t[0] === i.tab)[1], onclick: () => UI.go(i.tab) }) : null)))));
    }
    return wrap;
  }
  function filesBox() {
    const box = h('div', { class: 'files' }), b = S.book;
    if (S.building) { box.append(h('p', { class: 'building', id: 'build-step', text: 'Starting' })); return box; }
    if (!S.files) {
      const errs = S.pre.filter(i => i.level === 'error').length;
      box.append(h('p', { text: 'One run builds, for each selected store, a print-ready interior PDF and a wrap cover PDF with the spine and barcode, plus an EPUB, a Word file, an ebook cover and the preflight report.' }),
        errs ? h('p', { class: 'hint', text: errs + ' item' + (errs === 1 ? '' : 's') + ' above would be rejected by a store. You can still build the files to proof them.' }) : null,
        btn('Build all files', async () => { S.building = true; UI.render(); try { await UI.buildAll(msg => { const el = $('#build-step'); if (el) el.textContent = msg + '…'; }); } catch (e) { console.error(e); UI.toast('Building failed: ' + e.message, 'bad'); } S.building = false; UI.render(); }, 'primary big'));
      return box;
    }
    const total = S.files.reduce((n, f) => n + f.bytes.length, 0);
    if (!UI.canSave()) box.append(h('p', { class: 'pf-item bad', text: 'This view cannot save files to your device. Open the page on claude.ai in a browser, then build again.' }));
    box.append(h('div', { class: 'row wrap' }, btn('Save everything (.zip, ' + UI.fmtBytes(total) + ')', async () => { UI.toast('Packing the zip…'); const z = await UI.zipAll(); await UI.save(UI.slug() + '-files.zip', new Blob([z])); }, 'primary big'), btn('Rebuild', () => { S.files = null; UI.render(); }, '')));
    let last = null; const list = h('div', { class: 'file-list' });
    for (const f of S.files) { if (f.folder !== last) { last = f.folder; list.append(h('h4', { text: f.folder || 'Report' })); } list.append(h('div', { class: 'file' }, h('div', null, h('div', { class: 'file-name', text: f.label }), h('div', { class: 'hint', text: f.name + ' · ' + UI.fmtBytes(f.bytes.length) + ' · ' + f.note })), btn('Save', () => UI.save(f.name, new Blob([f.bytes])), 'mini'))); }
    box.append(list);
    return box;
  }
  function paneExport() {
    const pf = h('div', { id: 'pf-holder' }, preflightList()); dyn.push(() => { pf.innerHTML = ''; pf.append(preflightList()); });
    return h('div', { class: 'form' },
      group('Preflight', h('p', { class: 'hint', text: 'Every item a store’s upload check would reject or question, with the place to fix it. Store rules as published, ' + BF.SPEC_DATE + '.' }), pf),
      group('Files', filesBox()),
      group('What these files are', h('ul', { class: 'plain' },
        h('li', { text: 'Interior PDFs: single pages at trim size (plus bleed where the store wants it), every font embedded, black text in pure black, pictures in greyscale for black-ink paper.' }),
        h('li', { text: 'Cover PDFs: back, spine and front on one sheet with 0.125 in bleed (3 mm for BookVault), in RGB. They are not certified PDF/X-1a; IngramSpark accepts them but converts the colour itself.' }),
        h('li', { text: 'Text is set in Latin-script fonts. Arabic, Chinese and other scripts are flagged in preflight and are not typeset.' }),
        h('li', { text: 'Always order a printed proof before you approve a title.' }))));
  }

  /* ================= shell ================= */
  const TABS = [['manuscript', 'Manuscript'], ['setup', 'Setup'], ['matter', 'Front & back'], ['cover', 'Cover'], ['export', 'Check & export']];
  const PANES = { manuscript: paneManuscript, setup: paneSetup, matter: paneMatter, cover: paneCover, export: paneExport };
  UI.go = function (tab) { S.tab = tab; UI.render(); $('#pane').scrollTop = 0; if (tab === 'cover') { S.view = 'cover'; UI.syncViewButtons(); UI.paintSoon(); } };
  UI.afterLayout = function () { for (const f of dyn) { try { f(); } catch (e) { console.error(e); } } const cs = $('#cover-store'); if (cs) { const st = BF.activeStores(S.book.setup); cs.innerHTML = ''; st.forEach(id => cs.append(h('option', { value: id, text: BF.STORES[id].short + ' cover', selected: id === S.coverStore }))); } };
  UI.render = function () {
    dyn = [];
    const tabs = $('#tabs'); tabs.innerHTML = '';
    TABS.forEach(([id, label], i) => tabs.append(h('button', { type: 'button', role: 'tab', id: 'tab-' + id, 'aria-selected': S.tab === id ? 'true' : 'false', class: 'tab' + (S.tab === id ? ' on' : ''), onclick: () => UI.go(id) }, h('span', { class: 'tab-n', text: String(i + 1) }), h('span', { text: label }))));
    const pane = $('#pane'), top = pane.scrollTop; pane.innerHTML = ''; pane.append(PANES[S.tab]()); pane.scrollTop = top;
    pane.querySelectorAll('textarea').forEach(grow);
    $('#sample-flag').hidden = !S.book.sample;
    if (S.lay) UI.afterLayout();
  };

  async function newBook(skipAsk) {
    if (!skipAsk && !S.book.sample && S.book.sections.some(hasContent) && !(await UI.confirm('Start a new book?', 'The current book is cleared from this browser. Save a project file first if you want to keep it.', 'Start new'))) return;
    const nb = BF.newBook(); nb.sections = [BF.newSection('chapter', '')]; S.book = nb; S.sel = nb.sections[0].id; S.spread = 0; S.files = null; S.tab = 'manuscript'; UI.render(); ch(true);
  }
  async function boot() {
    $('#prompt-labels').append(...BF.PROMPT_LABELS.map(l => h('option', { value: l })));
    $('#btn-new').onclick = () => newBook(false);
    $('#flag-new').onclick = () => newBook(true);
    $('#flag-import').onclick = () => { S.tab = 'manuscript'; UI.render(); pickFile('.docx,.md,.markdown,.txt', importFile); };
    $('#btn-save').onclick = () => UI.save(UI.slug() + '.bookproject.json', new Blob([UI.projectJSON()]));
    $('#btn-open').onclick = () => pickFile('.json,application/json', async f => { try { S.book = await UI.openProject(await f.text()); S.sel = null; S.files = null; S.spread = 0; UI.render(); ch(true); UI.toast('Opened ' + f.name, 'good'); } catch (e) { UI.toast('That is not a Book Formatter project file.', 'bad'); } });
    $('#view-pages').onclick = () => { S.view = 'pages'; UI.syncViewButtons(); UI.paintSoon(); };
    $('#view-cover').onclick = () => { S.view = 'cover'; UI.syncViewButtons(); UI.paintSoon(); };
    $('#cover-store').onchange = e => { S.coverStore = e.target.value; UI.paintSoon(); };
    $('#guides').onchange = e => { S.guides = e.target.checked; UI.paintSoon(); };
    const step = d => { S.spread = Math.max(0, Math.min(Math.floor(S.lay.pageCount / 2), S.spread + d)); UI.paintSoon(); };
    $('#pg-prev').onclick = () => step(-1); $('#pg-next').onclick = () => step(1);
    $('#pg-range').oninput = e => { S.spread = +e.target.value; UI.paintSoon(); };
    $('#stage').addEventListener('keydown', e => { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); });
    window.addEventListener('resize', UI.paintSoon);
    if (window.ResizeObserver) new ResizeObserver(UI.paintSoon).observe($('#stage'));
    new MutationObserver(UI.paintSoon).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    S.book = (await UI.loadDraft()) || (await UI.loadSample());
    S.sel = (BF.orderedSections(S.book).find(s => s.kind === 'chapter') || {}).id;
    UI.render(); UI.relayout(); UI.syncViewButtons();
    if (S.sel) UI.showSection(S.sel);
    document.body.classList.add('ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
