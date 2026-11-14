/* App shell: state, preview canvas, storage, file building. */
(function () {
  'use strict';
  const BF = window.BF, IN = 72, UI = BF.UI = {};
  const $ = s => document.querySelector(s);
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v; else if (k === 'checked') el.checked = !!v; else if (k === 'selected') el.selected = !!v; else if (k === 'disabled') el.disabled = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) { const c = arguments[i]; if (c == null || c === false) continue; if (Array.isArray(c)) c.forEach(x => x != null && x !== false && el.append(x)); else el.append(c); }
    return el;
  }
  UI.h = h; UI.$ = $;
  const S = UI.S = { book: null, lay: null, covers: {}, pre: [], tab: 'manuscript', sel: null, view: 'pages', spread: 0, guides: true, coverStore: null, files: null, building: false, dl: undefined };
  const fmtBytes = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  UI.fmtBytes = fmtBytes;
  UI.slug = () => (S.book.meta.title || 'book').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'book';

  /* ----- toast and dialog ----- */
  let toastT = null;
  UI.toast = function (msg, kind) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + (kind || ''); clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast'; }, kind === 'bad' ? 7000 : 3600); };
  UI.dialog = function (title, body, buttons) {
    return new Promise(res => {
      const d = $('#dlg'); d.innerHTML = '';
      const close = v => { if (d.open) d.close(); res(v); };
      d.append(h('h2', { text: title }), h('div', { class: 'dlg-body' }, body), h('div', { class: 'dlg-actions' }, buttons.map(b => h('button', { class: b.primary ? 'btn primary' : 'btn', type: 'button', text: b.label, onclick: () => close(b.value) }))));
      d.oncancel = e => { e.preventDefault(); close(null); };
      if (d.showModal) d.showModal(); else d.setAttribute('open', '');
      const f = d.querySelector('textarea, input'); if (f) f.focus();
    });
  };
  UI.confirm = (title, text, yes) => UI.dialog(title, h('p', { text }), [{ label: 'Cancel', value: false }, { label: yes || 'Continue', value: true, primary: true }]);

  /* ----- fonts for the on-screen proof ----- */
  BF.onFontLoad = function (f) {
    try { const ff = new FontFace('BF-' + f.key, 'url(data:font/ttf;base64,' + BF.FONT_B64[f.key] + ')'); ff.load().then(x => { document.fonts.add(x); UI.paintSoon(); }).catch(() => {}); } catch (e) { /* proof falls back to a system face */ }
  };

  /* ----- images ----- */
  UI.makeAsset = async function (bytes, type, name, id) {
    const url = URL.createObjectURL(new Blob([bytes], { type })), el = new Image();
    el.src = url; await el.decode();
    return { id: id || BF.uid(), name: name || 'image', type, bytes, w: el.naturalWidth, h: el.naturalHeight, el, url };
  };
  UI.pickImage = function () {
    return new Promise(res => {
      const inp = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif' });
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return res(null);
        try { const a = await UI.makeAsset(new Uint8Array(await f.arrayBuffer()), f.type || 'image/jpeg', f.name); S.book.images[a.id] = a; res(a.id); }
        catch (e) { UI.toast('That file could not be read as a picture. Use a PNG or JPEG.', 'bad'); res(null); }
      };
      inp.click();
    });
  };
  async function sampleImage(id, w, hh, c1, c2, label) {
    const cv = h('canvas'); cv.width = w; cv.height = hh; const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, w, hh); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, w, hh);
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = w / 260;
    for (let k = 0; k < 7; k++) { x.beginPath(); x.arc(w * (0.16 + k * 0.115), hh * (0.5 + Math.sin(k * 1.1) * 0.16), hh * 0.2, 0, Math.PI * 2); x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,.9)'; x.font = '600 ' + Math.round(hh / 22) + 'px sans-serif'; x.fillText(label, w * 0.04, hh * 0.92);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
    return UI.makeAsset(new Uint8Array(await blob.arrayBuffer()), 'image/jpeg', label.toLowerCase().replace(/\s+/g, '-') + '.jpg', id);
  }
  UI.loadSample = async function () {
    const b = BF.sampleBook();
    b.images['sample-a'] = await sampleImage('sample-a', 1800, 900, '#14213d', '#fca311', 'SAMPLE CHAPTER IMAGE');
    b.images['sample-b'] = await sampleImage('sample-b', 1500, 1000, '#275a78', '#e6e6d2', 'SAMPLE SECTION IMAGE');
    return b;
  };

  /* ----- storage: a browser draft (best effort) and a project file (the real save) ----- */
  const strip = book => { const c = Object.assign({}, book, { images: {} }); return JSON.parse(JSON.stringify(c)); };
  function idb() { return new Promise((res, rej) => { const r = indexedDB.open('book-formatter', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  UI.saveDraft = async function () {
    try {
      const db = await idb(), imgs = {}; for (const id in S.book.images) { const a = S.book.images[id]; imgs[id] = { id, name: a.name, type: a.type, bytes: a.bytes }; }
      await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ book: strip(S.book), imgs }, 'draft'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (e) { /* storage is a convenience only */ }
  };
  UI.loadDraft = async function () {
    try {
      const db = await idb(), rec = await new Promise((res, rej) => { const rq = db.transaction('kv').objectStore('kv').get('draft'); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
      if (!rec || !rec.book || rec.book.sample) return null;
      const b = rec.book; b.images = {};
      for (const id in rec.imgs || {}) { try { b.images[id] = await UI.makeAsset(rec.imgs[id].bytes, rec.imgs[id].type, rec.imgs[id].name, id); } catch (e) { /* skip unreadable */ } }
      return b;
    } catch (e) { return null; }
  };
  UI.projectJSON = function () {
    const o = strip(S.book); o.app = 'book-formatter'; o.imageData = {};
    for (const id in S.book.images) { const a = S.book.images[id]; o.imageData[id] = { name: a.name, type: a.type, b64: BF.bytesToB64(a.bytes) }; }
    return JSON.stringify(o);
  };
  UI.openProject = async function (text) {
    const o = JSON.parse(text); if (o.app !== 'book-formatter' || !o.sections) throw new Error('not a project');
    const base = BF.newBook(), b = Object.assign(base, o); b.images = {};
    for (const k of ['meta', 'setup', 'front', 'cover']) b[k] = Object.assign({}, BF.newBook()[k], o[k] || {});
    for (const id in o.imageData || {}) { try { b.images[id] = await UI.makeAsset(BF.b64ToBytes(o.imageData[id].b64), o.imageData[id].type, o.imageData[id].name, id); } catch (e) { /* skip */ } }
    delete b.imageData; delete b.app; return b;
  };

  /* ----- saving files to the reader's device ----- */
  if (window.claude && typeof window.claude.use === 'function') { S.dl = undefined; window.claude.use('downloads').then(ns => { S.dl = ns; if (UI.render) UI.render(); }).catch(() => { S.dl = null; }); }
  else S.dl = false;                                   // standalone page: the browser saves directly
  UI.canSave = () => S.dl !== null;
  UI.save = async function (name, data) {
    const blob = data instanceof Blob ? data : new Blob([data]);
    if (S.dl === false) { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 20000); return true; }
    if (!S.dl) { UI.toast(S.dl === undefined ? 'Saving is still starting up. Try again in a moment.' : 'This view cannot save files. Open the page on claude.ai in a browser.', 'bad'); return false; }
    try { await S.dl.save({ filename: name, data: blob }); UI.toast('Saved ' + name, 'good'); return true; }
    catch (e) {
      const c = e && e.code;
      if (c === 'declined') UI.toast('Save cancelled.');
      else if (c === 'rate_limited') UI.toast('A save prompt is already open. Answer it, then try again.', 'bad');
      else if (c === 'too_large') UI.toast(name + ' is too large to save from this view. Save the store files one at a time.', 'bad');
      else if (c === 'rejected_extension' || c === 'extension_not_enabled') UI.toast('This view does not allow saving that file type.', 'bad');
      else UI.toast('The file could not be saved from this view.', 'bad');
      return false;
    }
  };

  /* ----- layout pipeline ----- */
  let layT = null, saveT = null;
  UI.changed = function (now) {
    S.files = null; if (S.book.sample && S.touched) { /* still the sample until replaced */ }
    clearTimeout(layT); layT = setTimeout(UI.relayout, now ? 0 : 320);
    clearTimeout(saveT); saveT = setTimeout(UI.saveDraft, 1800);
  };
  UI.relayout = function () {
    const b = S.book;
    try {
      S.lay = BF.layoutBook(b); S.covers = BF.buildCovers(b, S.lay); S.pre = BF.preflight(b, S.lay, S.covers);
      const maxSpread = Math.floor(S.lay.pageCount / 2); if (S.spread > maxSpread) S.spread = maxSpread;
      const st = BF.activeStores(b.setup); if (!st.includes(S.coverStore)) S.coverStore = st[0] || null;
    } catch (e) { console.error(e); UI.toast('The layout failed: ' + e.message, 'bad'); }
    UI.readout(); UI.paintSoon(); if (UI.afterLayout) UI.afterLayout();
  };
  UI.readout = function () {
    const b = S.book, lay = S.lay, el = $('#readout'); if (!lay) return;
    const t = BF.trim(b.setup.trim), st = BF.activeStores(b.setup), sp = st.length ? BF.spineInches(st[0], lay.pageCount, b.setup) : null;
    const err = S.pre.filter(i => i.level === 'error').length, warn = S.pre.filter(i => i.level === 'warn').length;
    el.innerHTML = '';
    el.append(h('span', { text: BF.trimLabel(t) }), h('span', { text: lay.pageCount + ' pp' }), h('span', { text: lay.words.toLocaleString() + ' words' }),
      sp ? h('span', { text: 'spine ' + sp.w.toFixed(3) + ' in (' + BF.STORES[st[0]].short + ')' }) : null,
      h('button', { class: 'pill ' + (err ? 'bad' : warn ? 'warn' : 'good'), type: 'button', title: 'Open the preflight list', onclick: () => UI.go('export'), text: err ? err + ' to fix' : warn ? warn + ' to check' : 'Preflight clear' }));
  };

  /* ----- proof painting ----- */
  const css = c => { if (c == null) c = 0; if (typeof c === 'number') { const v = Math.round(c * 255); return 'rgb(' + v + ',' + v + ',' + v + ')'; } return 'rgb(' + c.map(v => Math.round(v * 255)).join(',') + ')'; };
  function paintOps(x, ops, sc, dx, dy, gray) {
    for (const o of ops) {
      if (o.t === 'r') { x.fillStyle = css(o.c); x.fillRect((o.x + dx) * sc, (o.y + dy) * sc, o.w * sc, o.h * sc); }
      else if (o.t === 'sr') { x.strokeStyle = css(o.c); x.lineWidth = Math.max(0.5, (o.lw || 0.5) * sc); x.strokeRect((o.x + dx) * sc, (o.y + dy) * sc, o.w * sc, o.h * sc); }
      else if (o.t === 'l') { x.strokeStyle = css(o.c); x.lineWidth = Math.max(0.5, (o.lw || 0.5) * sc); x.beginPath(); x.moveTo((o.x1 + dx) * sc, (o.y1 + dy) * sc); x.lineTo((o.x2 + dx) * sc, (o.y2 + dy) * sc); x.stroke(); }
      else if (o.t === 't') {
        x.font = (o.z * sc) + 'px "BF-' + BF.getFont(o.f).key + '", serif'; x.fillStyle = css(o.c);
        if ('letterSpacing' in x) x.letterSpacing = ((o.ls || 0) * sc) + 'px';
        if (o.rot === 90) { x.save(); x.translate((o.x + dx) * sc, (o.y + dy) * sc); x.rotate(Math.PI / 2); x.fillText(o.s, 0, 0); x.restore(); }
        else x.fillText(o.s, (o.x + dx) * sc, (o.y + dy) * sc);
      } else if (o.t === 'i') {
        const a = S.book.images[o.img]; if (!a || !a.el) continue;
        if (gray && 'filter' in x) x.filter = 'grayscale(1)';
        if (o.fit === 'cover') { const s = Math.max(o.w / a.w, o.h / a.h), sw = o.w / s, sh = o.h / s; x.drawImage(a.el, (a.w - sw) / 2, (a.h - sh) / 2, sw, sh, (o.x + dx) * sc, (o.y + dy) * sc, o.w * sc, o.h * sc); }
        else x.drawImage(a.el, (o.x + dx) * sc, (o.y + dy) * sc, o.w * sc, o.h * sc);
        if (gray && 'filter' in x) x.filter = 'none';
      }
    }
    if ('letterSpacing' in x) x.letterSpacing = '0px';
  }
  UI.paintOps = paintOps;
  let paintQ = false;
  UI.paintSoon = function () { if (paintQ) return; paintQ = true; requestAnimationFrame(() => { paintQ = false; UI.paint(); }); };
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  UI.paint = function () {
    const cv = $('#cv'), stage = $('#stage'), lay = S.lay; if (!lay || !stage.clientWidth) return;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1), cw = stage.clientWidth, ch = stage.clientHeight;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, cw, ch);
    const guide = tok('--guide'), mag = tok('--accent'), b = S.book, paper = BF.paper(b.setup.paper);
    if (S.view === 'cover') {
      const cov = S.covers[S.coverStore]; if (!cov) { x.fillStyle = tok('--muted'); x.font = '14px sans-serif'; x.fillText('Select a store under Setup to see its cover.', 24, 40); UI.pager(); return; }
      const sc = Math.min((cw - 36) / cov.W, (ch - 60) / cov.H), ox = (cw - cov.W * sc) / 2, oy = (ch - cov.H * sc) / 2 + 8;
      x.save(); x.translate(ox, oy); x.shadowColor = 'rgba(0,0,0,.3)'; x.shadowBlur = 16; x.fillStyle = '#fff'; x.fillRect(0, 0, cov.W * sc, cov.H * sc); x.shadowBlur = 0; x.shadowColor = 'transparent';
      x.beginPath(); x.rect(0, 0, cov.W * sc, cov.H * sc); x.clip(); paintOps(x, cov.ops, sc, 0, 0, false);
      if (S.guides) {
        const g = cov.geom; x.lineWidth = 1; x.strokeStyle = guide; x.setLineDash([]);
        x.strokeRect(g.bl * sc, g.bl * sc, (cov.W - 2 * g.bl) * sc, g.th * sc);
        x.setLineDash([5, 4]); for (const fx of [g.spineX, g.frontX]) { x.beginPath(); x.moveTo(fx * sc, 0); x.lineTo(fx * sc, cov.H * sc); x.stroke(); }
        x.strokeStyle = mag; x.setLineDash([2, 3]);
        for (const px of [g.backX, g.frontX]) x.strokeRect((px + g.safe) * sc, (g.bl + g.safe) * sc, (g.tw - 2 * g.safe) * sc, (g.th - 2 * g.safe) * sc);
        if (g.barcode) x.strokeRect(g.barcode.x * sc, g.barcode.y * sc, g.barcode.w * sc, g.barcode.h * sc);
        x.setLineDash([]);
      }
      x.restore();
      if (S.guides) { x.fillStyle = tok('--muted'); x.font = '11px "IBM Plex Mono", monospace'; x.textAlign = 'center'; const g = cov.geom, y = oy - 8;
        x.fillText('BACK', ox + (g.backX + g.tw / 2) * sc, y); x.fillText('FRONT', ox + (g.frontX + g.tw / 2) * sc, y); x.fillText(cov.spine.w.toFixed(3) + ' in', ox + (g.spineX + g.sw / 2) * sc, oy + cov.H * sc + 16); x.textAlign = 'left'; }
      UI.pager(); return;
    }
    const W = lay.geo.W, H = lay.geo.H, single = cw < 560, m = lay.geo.m;
    const sc = Math.min((cw - 32) / (single ? W : 2 * W), (ch - 32) / H), pw = W * sc, ph = H * sc, oy = (ch - ph) / 2;
    const idxL = S.spread * 2 - 1, idxR = S.spread * 2, list = single ? [S.single == null ? Math.max(0, idxR < lay.pageCount ? idxR : idxL) : S.single] : [idxL, idxR];
    const ox = (cw - (single ? pw : 2 * pw)) / 2, tint = paper.id === 'cream' ? '#fbf5e6' : '#ffffff', gray = !paper.color;
    list.forEach((pi, k) => {
      const px = ox + k * pw; if (pi < 0 || pi >= lay.pageCount) return;
      const p = lay.pages[pi];
      x.save(); x.shadowColor = 'rgba(0,0,0,.28)'; x.shadowBlur = 14; x.shadowOffsetY = 3; x.fillStyle = tint; x.fillRect(px, oy, pw, ph); x.restore();
      x.save(); x.beginPath(); x.rect(px, oy, pw, ph); x.clip(); x.translate(px, oy); paintOps(x, p.ops, sc, 0, 0, gray);
      if (S.guides) { const fx = p.side === 'r' ? m.inside : m.outside; x.strokeStyle = guide; x.lineWidth = 1; x.setLineDash([4, 4]); x.strokeRect(fx * sc, m.top * sc, (W - m.inside - m.outside) * sc, (H - m.top - m.bottom) * sc); x.setLineDash([]); }
      x.restore();
    });
    if (!single && idxL >= 0 && idxR < lay.pageCount) { const gx = ox + pw; const g = x.createLinearGradient(gx - 14, 0, gx + 14, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,.13)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(gx - 14, oy, 28, ph); }
    UI.pager();
  };
  UI.pager = function () {
    const lay = S.lay, lab = $('#pg-label'), max = Math.floor(lay.pageCount / 2);
    $('#pg-prev').disabled = S.view !== 'pages' || S.spread <= 0; $('#pg-next').disabled = S.view !== 'pages' || S.spread >= max;
    const rng = $('#pg-range'); rng.max = max; rng.value = S.spread; rng.disabled = S.view !== 'pages';
    if (S.view === 'cover') { const cov = S.covers[S.coverStore]; lab.textContent = cov ? 'Cover sheet ' + (cov.W / IN).toFixed(3) + ' × ' + (cov.H / IN).toFixed(3) + ' in' : ''; return; }
    const a = S.spread * 2 - 1, b = S.spread * 2, parts = [];
    for (const i of [a, b]) if (i >= 0 && i < lay.pageCount) parts.push(lay.pages[i].blank ? 'blank' : lay.pages[i].label);
    lab.textContent = 'Page ' + parts.join(' | ') + '   (' + Math.min(lay.pageCount, b + 1) + ' of ' + lay.pageCount + ')';
  };
  UI.showSection = function (id) { const lay = S.lay; if (!lay) return; const idx = lay.anchors.get(id); if (idx != null) { S.view = 'pages'; S.spread = Math.floor((idx + 1) / 2); UI.syncViewButtons(); UI.paintSoon(); } };
  UI.syncViewButtons = function () { $('#view-pages').setAttribute('aria-pressed', S.view === 'pages'); $('#view-cover').setAttribute('aria-pressed', S.view === 'cover'); $('#cover-store').hidden = S.view !== 'cover'; };

  /* ----- build every file ----- */
  UI.ebookCover = async function () {
    const b = S.book, t = BF.trim(b.setup.trim), ph = 2560, pw = Math.round(ph * t.w / t.h), cv = h('canvas'); cv.width = pw; cv.height = ph;
    const x = cv.getContext('2d'), W = t.w * IN, H = t.h * IN; x.fillStyle = '#fff'; x.fillRect(0, 0, pw, ph);
    const ops = BF.frontCoverOps(b, W, H); for (const o of ops) if (o.t === 't') BF.getFont(o.f);
    try { await document.fonts.ready; await Promise.all(Array.from(document.fonts).filter(f => /^BF-/.test(f.family)).map(f => f.loaded.catch(() => null))); } catch (e) { /* draw anyway */ }
    paintOps(x, ops, pw / W, 0, 0, false);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w: pw, h: ph };
  };
  UI.buildAll = async function (onStep) {
    const b = S.book, slug = UI.slug(), files = [], tick = async msg => { onStep(msg); await new Promise(r => setTimeout(r, 30)); };
    S.lay = BF.layoutBook(b); S.covers = BF.buildCovers(b, S.lay); S.pre = BF.preflight(b, S.lay, S.covers);
    const lay = S.lay, cache = new Map();
    await tick('Drawing the ebook cover');
    const ec = await UI.ebookCover(); files.push({ name: slug + '-ebook-cover.jpg', folder: 'Ebook', bytes: ec.bytes, label: 'Ebook cover', note: ec.w + ' × ' + ec.h + ' px JPEG' });
    for (const id of BF.activeStores(b.setup)) {
      const Sx = BF.STORES[id], key = JSON.stringify(BF.interiorBleed(b, id));
      await tick('Typesetting the ' + Sx.short + ' interior');
      if (!cache.has(key)) cache.set(key, await BF.buildInteriorPDF(b, lay, id));
      const ib = BF.interiorBleed(b, id), t = BF.trim(b.setup.trim);
      files.push({ name: slug + '-interior-' + id + '.pdf', folder: Sx.name, bytes: cache.get(key), label: Sx.short + ' interior', note: lay.pageCount + ' pages, ' + (t.w + ib.out + ib.inn).toFixed(3) + ' × ' + (t.h + ib.top + ib.bottom).toFixed(3) + ' in' });
      await tick('Building the ' + Sx.short + ' cover');
      const cov = S.covers[id];
      files.push({ name: slug + '-cover-' + id + '.pdf', folder: Sx.name, bytes: await BF.buildCoverPDF(b, cov), label: Sx.short + ' cover', note: (cov.W / IN).toFixed(3) + ' × ' + (cov.H / IN).toFixed(3) + ' in, spine ' + cov.spine.w.toFixed(3) + ' in' });
    }
    await tick('Writing the EPUB');
    files.push({ name: slug + '.epub', folder: 'Ebook', bytes: await BF.buildEPUB(b, ec.bytes), label: 'EPUB', note: 'EPUB 3 for KDP, Kobo, Apple Books, Draft2Digital, B&N' });
    await tick('Writing the Word file');
    files.push({ name: slug + '.docx', folder: 'Editing', bytes: await BF.buildDOCX(b, lay.geo), label: 'Word document', note: 'For editors and proofreaders' });
    files.push({ name: slug + '-preflight.txt', folder: '', bytes: BF.utf8(BF.preflightText(b, lay, S.pre)), label: 'Preflight report', note: 'Plain text' });
    S.files = files; return files;
  };
  UI.zipAll = async function () {
    const slug = UI.slug();
    return BF.zip(S.files.map(f => ({ name: slug + '/' + (f.folder ? f.folder.replace(/[^A-Za-z0-9 &]/g, '') + '/' : '') + f.name, data: f.bytes, store: /\.(jpg|epub|docx)$/.test(f.name) })));
  };
})();
