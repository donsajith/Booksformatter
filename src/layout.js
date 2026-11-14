/* Interior typesetting: manuscript model -> pages of drawing ops (top-left origin, points). */
(function (G) {
  'use strict';
  const BF = G.BF, IN = 72, fk = BF.fontKey, F = BF.getFont;

  /* ---------- text parsing ---------- */
  function smart(t, prev) {
    let out = '';
    for (let k = 0; k < t.length; k++) {
      const c = t[k], p = k ? t[k - 1] : prev, n = t[k + 1] || '';
      const opens = !p || /[\s(\[{—–\-‘“]/.test(p);
      if (c === '"') out += opens ? '“' : '”';
      else if (c === "'") out += opens && !/\d/.test(n) ? '‘' : '’';
      else if (c === '-' && n === '-') { out += '—'; k++; if (t[k + 1] === '-') k++; }
      else if (c === '.' && n === '.' && t[k + 2] === '.') { out += '…'; k += 2; }
      else out += c;
    }
    return out;
  }
  BF.smart = s => smart(String(s || ''), '');
  BF.parseInline = function (src, doSmart) {
    const runs = []; let b = false, i = false, code = false, buf = '';
    const flush = () => { if (buf) { runs.push({ t: buf, b, i, code }); buf = ''; } };
    src = String(src || '');
    for (let p = 0; p < src.length; p++) {
      const ch = src[p];
      if (ch === '\\' && p + 1 < src.length && /[*`\\#>\-=]/.test(src[p + 1])) { buf += src[++p]; continue; }
      if (ch === '`') { flush(); code = !code; continue; }
      if (!code && ch === '*') {
        let n = 1; while (src[p + n] === '*' && n < 3) n++;
        const before = p > 0 ? src[p - 1] : ' ', after = src[p + n] || ' ';
        const on = n === 1 ? i : n === 2 ? b : (b && i);
        if ((on && !/\s/.test(before)) || (!on && !/\s/.test(after))) {
          flush(); if (n === 1) i = !i; else if (n === 2) b = !b; else { b = !on; i = !on; }
          p += n - 1; continue;
        }
      }
      buf += ch;
    }
    flush();
    if (doSmart) { let prev = ''; for (const r of runs) { if (!r.code) r.t = smart(r.t, prev); prev = r.t.slice(-1) || prev; } }
    return runs;
  };
  function joinParas(buf) {
    const groups = [[]];
    for (const l of buf) { if (!l.trim()) groups.push([]); else groups[groups.length - 1].push(l.trim()); }
    const out = [];
    for (const g of groups) {
      if (!g.length) continue;
      if (g.length > 1 && g.some(l => l.length > 100)) out.push(...g); else out.push(g.join(' '));
    }
    return out;
  }
  const LIST = /^\s*([-*•]|\d{1,3}[.)])\s+/;
  BF.parseText = function (md) {
    const lines = String(md || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'); const out = []; let i = 0, m;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      if (/^\s*(\*\s*\*\s*\*|-\s*-\s*-|#\s+#\s+#|⁂)\s*$/.test(l)) { out.push({ k: 'scene' }); i++; continue; }
      if (/^\s*={3,}\s*$/.test(l)) { out.push({ k: 'break' }); i++; continue; }
      if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { out.push({ k: 'h', level: m[1].length >= 3 ? 3 : 2, text: m[2].replace(/\s*#+\s*$/, '') }); i++; continue; }
      if (/^```/.test(l)) {
        const info = l.slice(3).trim(), buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++; out.push({ k: 'prompt', label: info || 'Prompt', text: buf.join('\n') }); continue;
      }
      if (LIST.test(l)) {
        const ordered = /^\s*\d/.test(l), items = [], start = ordered ? parseInt(l, 10) || 1 : 1;
        while (i < lines.length && lines[i].trim()) {
          if (LIST.test(lines[i])) items.push(lines[i].replace(LIST, '')); else items[items.length - 1] += ' ' + lines[i].trim();
          i++;
        }
        out.push({ k: ordered ? 'ol' : 'ul', items, start }); continue;
      }
      if (/^\s*>/.test(l)) {
        const buf = []; while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out.push({ k: 'quote', paras: joinParas(buf) }); continue;
      }
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*>)/.test(lines[i]) && !LIST.test(lines[i]) && !/^\s*(\*\s*\*\s*\*|={3,})\s*$/.test(lines[i])) buf.push(lines[i++]);
      for (const p of joinParas(buf)) out.push({ k: 'p', text: p });
    }
    return out;
  };

  /* A flat reading-order view of a section, shared by the EPUB and DOCX writers. */
  BF.walkSection = function (sec, doSmart) {
    const items = [];
    const push = (blk, sub) => {
      if (sub.k === 'p') items.push({ k: 'p', runs: BF.parseInline(sub.text, doSmart) });
      else if (sub.k === 'h') items.push({ k: 'h', level: sub.level, text: doSmart ? BF.smart(sub.text) : sub.text });
      else if (sub.k === 'ul' || sub.k === 'ol') items.push({ k: sub.k, start: sub.start, items: sub.items.map(t => BF.parseInline(t, doSmart)) });
      else if (sub.k === 'quote') items.push({ k: 'quote', paras: sub.paras.map(t => BF.parseInline(t, doSmart)) });
      else if (sub.k === 'prompt') items.push({ k: 'prompt', label: sub.label, tool: '', text: sub.text });
      else items.push({ k: sub.k });
    };
    for (const blk of sec.blocks || []) {
      if (blk.type === 'h') items.push({ k: 'h', level: blk.level || 2, text: doSmart ? BF.smart(blk.text) : blk.text });
      else if (blk.type === 'text') for (const sub of BF.parseText(blk.md)) push(blk, sub);
      else if (blk.type === 'image') items.push({ k: 'image', img: blk.img, caption: blk.caption || '' });
      else if (blk.type === 'prompt') items.push({ k: 'prompt', label: blk.label || 'Prompt', tool: blk.tool || '', text: blk.text || '', look: blk.look });
      else if (blk.type === 'break') items.push({ k: 'break' });
    }
    return items;
  };
  BF.chapterNumbers = function (book) {
    const map = new Map(); let n = 0;
    for (const s of book.sections) if (s.kind === 'chapter' && s.numbered !== false) map.set(s.id, ++n);
    return map;
  };
  BF.orderedSections = book => [...book.sections.filter(s => s.kind === 'front'), ...book.sections.filter(s => s.kind === 'chapter'), ...book.sections.filter(s => s.kind === 'back')];
  BF.defaultCopyright = function (m) {
    const L = ['Copyright © ' + (m.year || new Date().getFullYear()) + ' ' + (m.author || 'the author'), '',
      'All rights reserved. No part of this publication may be reproduced, stored or transmitted in any form or by any means without the prior written permission of the publisher, except for brief quotations in reviews.', ''];
    if (m.edition) L.push(m.edition);
    if (m.isbnPrint) L.push('ISBN ' + m.isbnPrint + ' (paperback)');
    if (m.isbnEbook) L.push('ISBN ' + m.isbnEbook + ' (ebook)');
    if (m.publisher) L.push('', 'Published by ' + m.publisher);
    return L.join('\n');
  };

  /* ---------- words and lines ---------- */
  function splitBreaks(p) {
    const out = []; let s = 0;
    for (let k = 2; k < p.length - 1; k++) {
      if (/[-—–\/]/.test(p[k]) && /[A-Za-z]/.test(p[k - 1]) && /[A-Za-z]/.test(p[k - 2]) && /[A-Za-z“]/.test(p[k + 1])) { out.push(p.slice(s, k + 1)); s = k + 1; }
    }
    out.push(p.slice(s)); return out;
  }
  function hyPoints(t) {
    const m = /^([^A-Za-z]*)([A-Za-z]{6,})([^A-Za-z]*)$/.exec(t);
    if (!m || /[A-Z]/.test(m[2].slice(1))) return null;
    const pts = BF.hyphenate(m[2]);
    return pts.length ? pts.map(p => p + m[1].length) : null;
  }
  function toWords(runs, base, hyph) {
    const words = []; let cur = null;
    for (const r of runs) {
      const f = r.code ? 'mono-r' : fk(base.fam, base.b || r.b, base.i ? !r.i : r.i), z = r.code ? base.z * 0.88 : base.z;
      r.t.split(/[ \n]+/).forEach((p, idx) => {
        if (idx > 0) { if (cur) cur.sp = true; cur = null; }
        if (!p) return;
        (r.code ? [p] : splitBreaks(p)).forEach((sg, si) => {
          if (si > 0) cur = null;
          if (!cur) { cur = { fr: [], sp: false }; words.push(cur); }
          cur.fr.push({ t: sg, f, z });
        });
      });
    }
    for (const w of words) {
      let s = 0; for (const fr of w.fr) s += F(fr.f).width(fr.t, fr.z);
      const lf = w.fr[w.fr.length - 1], lF = F(lf.f);
      w.w = s; w.spw = w.sp ? lF.space * lf.z / lF.upm : 0;
      w.hy = hyph && w.fr.length === 1 && !/^mono/.test(lf.f) ? hyPoints(lf.t) : null;
    }
    return words;
  }
  function breakLines(words, widthAt, o) {
    const lines = [], n = words.length; let i = 0, pend = null, hyRun = 0;
    while (i < n) {
      const W = widthAt(lines.length), items = []; let x = 0, lastSp = 0, spSum = 0, hyph = false;
      for (;;) {
        if (i >= n) break;
        const wd = pend || words[i], lead = items.length ? lastSp : 0;
        if (x + lead + wd.w <= W + (o.justify ? (spSum + lead) * 0.1 : 0) + 0.01) { items.push(wd); x += lead + wd.w; spSum += lead; lastSp = wd.spw; pend = null; i++; continue; }
        let gaps = 0; for (const it of items) if (it.spw > 0) gaps++;
        const slack = W - x - lead;
        const loose = o.justify ? (gaps ? slack / gaps > 0.3 * o.spaceW : true) : slack > 0.14 * W;
        if (wd.hy && o.hyphenate && hyRun < 2 && i < n - 1 && items.length && loose) {
          const fr = wd.fr[0], Fo = F(fr.f);
          for (let k = wd.hy.length - 1; k >= 0; k--) {
            const cut = wd.hy[k], pre = fr.t.slice(0, cut) + '-', pw = Fo.width(pre, fr.z);
            if (x + lead + pw <= W + 0.01) {
              items.push({ fr: [{ t: pre, f: fr.f, z: fr.z }], w: pw, spw: 0 }); x += lead + pw;
              const rest = fr.t.slice(cut);
              pend = { fr: [{ t: rest, f: fr.f, z: fr.z }], w: Fo.width(rest, fr.z), spw: wd.spw, hy: wd.hy.slice(k + 1).map(p => p - cut).filter(p => p >= 2) };
              if (!pend.hy.length) pend.hy = null;
              hyph = true; break;
            }
          }
          if (hyph) break;
        }
        if (!items.length) {           // one word wider than the measure: break it by characters
          const fr = wd.fr[0], Fo = F(fr.f); let k = fr.t.length;
          while (k > 1 && Fo.width(fr.t.slice(0, k), fr.z) > W) k--;
          const pre = fr.t.slice(0, k), rest = fr.t.slice(k), pw = Fo.width(pre, fr.z);
          items.push({ fr: [{ t: pre, f: fr.f, z: fr.z }], w: pw, spw: 0 }); x = pw;
          const rfr = (rest ? [{ t: rest, f: fr.f, z: fr.z }] : []).concat(wd.fr.slice(1));
          if (rfr.length) { let s = 0; for (const q of rfr) s += F(q.f).width(q.t, q.z); pend = { fr: rfr, w: s, spw: wd.spw, hy: null }; }
          else { items[0].spw = wd.spw; lastSp = wd.spw; pend = null; i++; }
        }
        break;
      }
      hyRun = hyph ? hyRun + 1 : 0;
      lines.push({ items, w: x, last: false });
    }
    if (lines.length) lines[lines.length - 1].last = true;
    return lines;
  }
  function lineOps(line, x0, W, align, justify, by, color) {
    const items = line.items, ops = []; let gaps = 0;
    for (let k = 0; k < items.length - 1; k++) if (items[k].spw > 0) gaps++;
    let extra = 0;
    if (justify && !line.last && gaps > 0) { extra = (W - line.w) / gaps; if (extra > 12) extra = 0; }
    let x = x0 + (align === 'center' ? (W - line.w) / 2 : align === 'right' ? W - line.w : 0), run = null;
    for (let k = 0; k < items.length; k++) {
      const it = items[k], lastItem = k === items.length - 1;
      for (let q = 0; q < it.fr.length; q++) {
        const fr = it.fr[q], tail = q === it.fr.length - 1 && it.spw > 0 && !lastItem ? ' ' : '';
        if (run && run.f === fr.f && run.z === fr.z) run.s += fr.t + tail;
        else { run = { t: 't', x, y: by, s: fr.t + tail, f: fr.f, z: fr.z }; if (color != null) run.c = color; ops.push(run); }
        x += F(fr.f).width(fr.t, fr.z);
      }
      if (!lastItem && it.spw > 0) { x += it.spw + extra; if (extra !== 0) run = null; }
    }
    return ops;
  }
  BF.wrapPlain = function (str, fontKey, z, maxW) {
    const Fo = F(fontKey), out = []; let cur = '';
    for (const w of String(str).split(/\s+/).filter(Boolean)) {
      const t = cur ? cur + ' ' + w : w;
      if (cur && Fo.width(t, z) > maxW) { out.push(cur); cur = w; } else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  };
  function wrapMono(line, max) {
    if (line.length <= max) return [line];
    const out = [], indent = /^\s*/.exec(line)[0].slice(0, Math.floor(max / 3)); let rest = line;
    while (rest.length > max) {
      let cut = rest.lastIndexOf(' ', max); if (cut <= indent.length + 4) cut = max;
      out.push(rest.slice(0, cut)); rest = indent + rest.slice(cut).replace(/^ +/, '');
    }
    out.push(rest); return out;
  }
  const shift = (o, dx, dy) => o.t === 'l' ? Object.assign({}, o, { x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy }) : Object.assign({}, o, { x: o.x + dx, y: o.y + dy });
  const paraCache = new Map();

  /* ---------- interior ---------- */
  function layoutInterior(book, geo, labels) {
    const setup = book.setup, meta = book.meta, front = book.front || {}, st = BF.resolveStyle(setup);
    const W = geo.W, H = geo.H, m = geo.m, fw = W - m.inside - m.outside, fh = H - m.top - m.bottom;
    const lead = st.leadPt, z = st.size, doSmart = setup.smart !== false;
    const pages = [], anchors = new Map(), placed = [], notes = [];
    const nums = BF.chapterNumbers(book);
    const frameX = side => side === 'r' ? m.inside : m.outside;
    let cur = null, bodyStart = -1;

    function newPage(kind) {
      if (cur) commit(cur);
      cur = { ops: [], rows: [], y: 0, side: pages.length % 2 === 0 ? 'r' : 'l', kind: kind || 'body', index: pages.length, pageStart: 0 };
      pages.push(cur); return cur;
    }
    function blankPage() { const p = newPage('blank'); p.blank = true; return p; }
    function toRecto() { if (pages.length % 2 === 1) blankPage(); }
    function commit(p) {
      if (p.done) return; p.done = true;
      const fx = frameX(p.side), rows = p.rows;
      for (let a = 0; a < rows.length;) {             // prompt-box backgrounds first
        const bx = rows[a].r.box; if (!bx) { a++; continue; }
        let b = a; while (b + 1 < rows.length && rows[b + 1].r.box && rows[b + 1].r.box.id === bx.id) b++;
        const y0 = m.top + rows[a].y, y1 = m.top + rows[b].y + rows[b].r.h;
        if (bx.look === 'dark') p.ops.push({ t: 'r', x: fx, y: y0, w: fw, h: y1 - y0, c: 0.13 });
        else if (bx.look === 'outline') p.ops.push({ t: 'sr', x: fx + 0.35, y: y0 + 0.35, w: fw - 0.7, h: y1 - y0 - 0.7, c: 0.3, lw: 0.7 });
        else { p.ops.push({ t: 'r', x: fx, y: y0, w: fw, h: y1 - y0, c: 0.93 }); p.ops.push({ t: 'r', x: fx, y: y0, w: 2.4, h: y1 - y0, c: 0.3 }); }
        a = b + 1;
      }
      for (const pr of rows) {
        const r = pr.r, ry = m.top + pr.y;
        if (r.anchor) anchors.set(r.anchor, p.index);
        if (r.img) placed.push({ id: r.img.id, w: r.img.w, h: r.img.h, page: p.index, where: r.img.where });
        if (r.ops) for (const o of r.ops) p.ops.push(shift(o, fx, ry));
      }
      p.rows = null;
    }
    function place(rows) {
      let i = 0; const base = cur.rows.length; cur.pageStart = base;
      while (i < rows.length) {
        const r = rows[i];
        if (r.brk) { if (cur.rows.length) { const k = cur.kind, s = cur.sec; newPage(k); cur.sec = s; } i++; continue; }
        if (r.space && cur.rows.length === 0) { i++; continue; }
        if (cur.y + r.h > fh + 0.01 && cur.rows.length > cur.pageStart) {
          if (r.space) { const k = cur.kind, s = cur.sec; newPage(k); cur.sec = s; i++; continue; }
          /* keep-with-next: step back over trailing gaps, then over rows that must not end a page */
          const ps = cur.pageStart; let k = cur.rows.length;
          while (k > ps && cur.rows[k - 1].r.space) k--;
          let k2 = k;
          while (k2 > ps && (cur.rows[k2 - 1].r.nb || (cur.rows[k2 - 1].r.space && k2 - 1 > ps && cur.rows[k2 - 2].r.nb))) k2--;
          if (k2 <= ps) k2 = cur.rows.length;
          const back = cur.rows.length - k2;
          for (let b = 0; b < back; b++) { const pr = cur.rows.pop(); cur.y = pr.y; }
          while (cur.rows.length > ps && cur.rows[cur.rows.length - 1].r.space) { const pr = cur.rows.pop(); cur.y = pr.y; }
          i -= back;
          const kd = cur.kind, sc = cur.sec; newPage(kd); cur.sec = sc; continue;
        }
        cur.rows.push({ r, y: cur.y }); cur.y += r.h; i++;
      }
    }

    /* row builders */
    const sp = (h, extra) => Object.assign({ h, space: true }, extra || {});
    function paraRows(runs, o) {
      const key = o.cacheKey ? [o.cacheKey, o.fam, o.z, o.lead, o.W, o.x0 || 0, o.indent || 0, o.align || '', o.justify ? 1 : 0, o.b ? 1 : 0, o.i ? 1 : 0, o.initial ? 1 : 0, st.hyphenate ? 1 : 0, o.color == null ? '' : o.color, doSmart ? 1 : 0].join('|') : null;
      if (key && paraCache.has(key)) return paraCache.get(key);
      const words = toWords(runs, { fam: o.fam, z: o.z, b: o.b, i: o.i }, st.hyphenate && o.hy !== false);
      if (o.initial && words.length) {
        const fr = words[0].fr[0], mm = /^([“‘"']?[A-Za-z0-9])(.*)$/.exec(fr.t);
        if (mm) {
          const big = { t: mm[1], f: fk(st.head, false, false), z: o.z * 2.5 }, w0 = words[0];
          w0.fr = [big].concat(mm[2] ? [{ t: mm[2], f: fr.f, z: fr.z }] : []).concat(w0.fr.slice(1));
          let s = 0; for (const q of w0.fr) s += F(q.f).width(q.t, q.z); w0.w = s; w0.hy = null;
        }
      }
      const bF = F(fk(o.fam, o.b, o.i)), sw = bF.space * o.z / bF.upm, ind = o.indent || 0;
      const lines = breakLines(words, n => o.W - (n === 0 ? ind : 0), { justify: !!o.justify, hyphenate: st.hyphenate && o.hy !== false, spaceW: sw });
      const by = o.lead / 2 + o.z * 0.34;
      const rows = lines.map((ln, n) => ({ h: o.lead, ops: lineOps(ln, (o.x0 || 0) + (n === 0 ? ind : 0), o.W - (n === 0 ? ind : 0), o.align || 'left', !!o.justify, by, o.color) }));
      const n = rows.length; if (n >= 2 && !o.loose) { rows[0].nb = true; rows[n - 2].nb = true; }
      if (key) { if (paraCache.size > 30000) paraCache.clear(); paraCache.set(key, rows); }
      return rows;
    }
    const plain = (str, o) => paraRows([{ t: doSmart ? BF.smart(str) : String(str) }], o);
    const keep = rows => rows.map(r => Object.assign({}, r, { nb: true }));
    function headingRows(text, level, anchor) {
      const rows = [];
      if (level === 3) {
        rows.push(sp(lead * 0.8));
        rows.push(...keep(plain(text, { fam: st.body, z, lead, W: fw, b: true, i: true, hy: false })));
        rows.push({ h: lead * 0.15, nb: true });
      } else {
        const h2 = st.h2, fam = h2.fam === 'head' ? st.head : st.body, hl = Math.ceil(h2.z * 1.25 / (lead / 2)) * (lead / 2), x0 = h2.mark ? h2.z * 0.95 : 0;
        rows.push(sp(lead * 1.25));
        const hr = keep(plain(text, { fam, z: h2.z, lead: hl, W: fw - x0, x0, b: h2.b, i: h2.i, hy: false }));
        if (h2.mark && hr.length) hr[0] = Object.assign({}, hr[0], { ops: [{ t: 'r', x: 0, y: hl / 2 - h2.z * 0.28, w: h2.z * 0.5, h: h2.z * 0.5, c: 0.1 }].concat(hr[0].ops) });
        rows.push(...hr);
        rows.push({ h: lead * 0.45, nb: true });
      }
      if (anchor) { const first = rows.find(r => r.ops); if (first) rows[rows.indexOf(first)] = Object.assign({}, first, { anchor }); }
      return rows;
    }
    function imageRows(imgId, caption, size, maxFrac, where) {
      const a = book.images && book.images[imgId], rows = [sp(lead * 0.6)];
      if (!a) { rows.push({ h: lead * 3, ops: [{ t: 'sr', x: 0, y: 2, w: fw, h: lead * 3 - 4, c: 0.6, lw: 0.5 }, { t: 't', x: 8, y: lead * 1.7, s: 'Image not found', f: fk(st.body, false, true), z: 9, c: 0.4 }] }); notes.push({ k: 'missing-image' }); rows.push(sp(lead * 0.6)); return rows; }
      const frac = ({ full: 1, large: 0.8, medium: 0.6, small: 0.4 })[size] || 1;
      let w = fw * frac, h = w * a.h / a.w; const maxH = fh * (maxFrac || 0.7);
      if (h > maxH) { h = maxH; w = h * a.w / a.h; }
      const cap = caption ? paraRows(BF.parseInline(caption, doSmart), { fam: st.body, z: Math.max(7.5, z - 1.5), lead: Math.max(10.5, lead - 3), W: fw * 0.86, x0: fw * 0.07, align: 'center', i: true, hy: false, loose: true }) : [];
      rows.push({ h: h + (cap.length ? 5 : 0), ops: [{ t: 'i', x: (fw - w) / 2, y: 0, w, h, img: imgId }], nb: cap.length > 0, img: { id: imgId, w, h, where } });
      cap.forEach((r, n) => rows.push(n < cap.length - 1 ? Object.assign({}, r, { nb: true }) : r));
      rows.push(sp(lead * 0.6));
      return rows;
    }
    function promptRows(blk) {
      const look = blk.look || setup.promptLook || 'shaded', box = { id: BF.uid(), look }, pad = 9, pz = 8.3, pl = 11.6;
      const Fm = F('mono-r'), cw = Fm.width('M', pz), max = Math.max(20, Math.floor((fw - 2 * pad - 6) / cw));
      const tc = look === 'dark' ? 1 : 0.08, lc = look === 'dark' ? 0.72 : 0.36, hb = fk(st.head, true, false), hr = fk(st.head, false, false);
      const rows = [sp(lead * 0.7)];
      const label = String(blk.label || 'Prompt').toUpperCase(), lops = [{ t: 't', x: pad + 5, y: pad + 6.5, s: label, f: hb, z: 6.6, c: lc, ls: 1 }];
      if (blk.tool) { const tw = F(hr).width(blk.tool, 6.8); lops.push({ t: 't', x: fw - pad - tw, y: pad + 6.5, s: blk.tool, f: hr, z: 6.8, c: lc }); }
      rows.push({ h: pad + 13, ops: lops, box, nb: true });
      const lines = []; for (const src of String(blk.text || '').replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n')) lines.push(...wrapMono(src, max));
      while (lines.length > 1 && !lines[lines.length - 1].trim()) lines.pop();
      lines.forEach((ln, n) => rows.push({ h: pl, ops: ln ? [{ t: 't', x: pad + 5, y: pl * 0.72, s: ln, f: 'mono-r', z: pz, c: tc }] : null, box, nb: n === 0 || n === lines.length - 2 || n === lines.length - 1 }));
      rows.push({ h: pad, box });
      rows.push(sp(lead * 0.7));
      return rows;
    }
    function listRows(sub) {
      const rows = [sp(lead * 0.35)], ind = z * 1.9, bf = fk(st.body, false, false);
      sub.items.forEach((it, n) => {
        const pr = paraRows(BF.parseInline(it, doSmart), { cacheKey: 'li:' + it, fam: st.body, z, lead, W: fw - ind, x0: ind, justify: st.justify });
        const mark = sub.k === 'ol' ? (sub.start + n) + '.' : '•', mw = F(bf).width(mark, z);
        if (pr.length) pr.forEach((r, q) => rows.push(q === 0 ? Object.assign({}, r, { ops: [{ t: 't', x: ind - mw - z * 0.55, y: lead / 2 + z * 0.34, s: mark, f: bf, z }].concat(r.ops) }) : r));
        if (st.para === 'block') rows.push(sp(lead * 0.25));
      });
      rows.push(sp(lead * 0.35));
      return rows;
    }
    function blockRows(sec, opts) {
      const rows = []; let first = true, initial = !!opts.initial; const tocSub = front.tocSections;
      const para = (text, key) => {
        if (st.para === 'block' && !first) rows.push(sp(lead * 0.55));
        const useInit = initial && st.initial; initial = false;
        rows.push(...paraRows(BF.parseInline(text, doSmart), { cacheKey: 'p:' + text, fam: st.body, z, lead, W: fw, indent: st.para === 'indent' && !first ? z * 1.5 : 0, justify: st.justify, initial: useInit }));
        first = false;
      };
      const heading = (text, level, key) => { rows.push(...headingRows(text, level, level === 2 && tocSub ? key : null)); first = true; initial = false; };
      for (const blk of sec.blocks || []) {
        if (blk.type === 'h') heading(blk.text || '', blk.level || 2, blk.id);
        else if (blk.type === 'text') {
          let hn = 0;
          for (const sub of BF.parseText(blk.md)) {
            if (sub.k === 'p') para(sub.text);
            else if (sub.k === 'h') heading(sub.text, sub.level, blk.id + '#' + (hn++));
            else if (sub.k === 'ul' || sub.k === 'ol') { rows.push(...listRows(sub)); }
            else if (sub.k === 'quote') {
              rows.push(sp(lead * 0.5));
              sub.paras.forEach((t, n) => { if (n) rows.push(sp(lead * 0.3)); rows.push(...paraRows(BF.parseInline(t, doSmart), { cacheKey: 'q:' + t, fam: st.body, z: z - 0.5, lead, W: fw - z * 3.6, x0: z * 1.8, justify: st.justify })); });
              rows.push(sp(lead * 0.5)); first = true;
            }
            else if (sub.k === 'scene') { rows.push(sp(lead * 0.5), { h: lead, ops: [{ t: 't', x: fw / 2 - F(fk(st.body, false, false)).width('*   *   *', z) / 2, y: lead * 0.75, s: '*   *   *', f: fk(st.body, false, false), z }], nb: true }, sp(lead * 0.5)); first = true; }
            else if (sub.k === 'break') rows.push({ brk: true });
            else if (sub.k === 'prompt') { rows.push(...promptRows(sub)); }
          }
        }
        else if (blk.type === 'image') { rows.push(...imageRows(blk.img, blk.caption, blk.size, 0.7, 'section')); }
        else if (blk.type === 'prompt') { rows.push(...promptRows(blk)); }
        else if (blk.type === 'break') rows.push({ brk: true });
      }
      return rows;
    }
    function chapterLabel(sec) {
      const n = nums.get(sec.id); if (!n || sec.kind !== 'chapter') return '';
      return st.ch.label.replace('{W}', BF.numWord(n).toUpperCase()).replace('{N}', n).replace('{00}', String(n).padStart(2, '0'));
    }
    function openerRows(sec) {
      const c = st.ch, rows = [{ h: fh * c.drop, nb: true }], align = c.align, hasImg = sec.image && sec.image.id && book.images && book.images[sec.image.id];
      const place_ = sec.image && sec.image.place || 'above';
      if (hasImg && place_ === 'above') rows.push(...keep(imageRows(sec.image.id, sec.image.caption, 'full', 0.36, 'chapter').filter(r => !r.space)), { h: lead * 1.2, nb: true });
      const label = chapterLabel(sec);
      if (label) {
        const lf = fk(st.head, c.labelB, c.labelI), lw = F(lf).width(label, c.labelZ, c.labelLs), lh = Math.max(lead, c.labelZ * 1.15), x = align === 'center' ? (fw - lw + (c.labelLs || 0)) / 2 : 0;
        if (c.labelBox) rows.push({ h: lh + 8, nb: true, ops: [{ t: 'r', x: 0, y: 0, w: lw + 14, h: lh + 2, c: 0.1 }, { t: 't', x: 7, y: lh * 0.5 + c.labelZ * 0.36 + 1, s: label, f: lf, z: c.labelZ, ls: c.labelLs, c: 1 }] });
        else rows.push({ h: lh, nb: true, ops: [{ t: 't', x, y: lh / 2 + c.labelZ * 0.34, s: label, f: lf, z: c.labelZ, ls: c.labelLs || 0, c: c.labelC == null ? 0 : c.labelC }] }, { h: c.labelZ > 20 ? 4 : lead * 0.55, nb: true });
      }
      const title = c.titleCaps ? String(sec.title || '').toUpperCase() : (sec.title || 'Untitled');
      const tl = Math.round(c.titleZ * 1.22);
      if (c.titleLs) {                                   // letterspaced capitals: wrap by hand, one op per line
        const tf = fk(st.head, c.titleB, c.titleI), lines = BF.wrapPlain(BF.smart(title), tf, c.titleZ * (1 + c.titleLs / c.titleZ * 1.1), fw * 0.86);
        lines.forEach(ln => { const w = F(tf).width(ln, c.titleZ, c.titleLs) - c.titleLs; rows.push({ h: tl + 3, nb: true, ops: [{ t: 't', x: align === 'center' ? (fw - w) / 2 : 0, y: tl * 0.72, s: ln, f: tf, z: c.titleZ, ls: c.titleLs }] }); });
      } else rows.push(...keep(plain(title, { fam: st.head, z: c.titleZ, lead: tl, W: align === 'center' ? fw * 0.9 : fw, x0: align === 'center' ? fw * 0.05 : 0, b: c.titleB, i: c.titleI, align, hy: false })));
      if (rows.length > 1) { const idx = rows.findIndex(r => r.ops && !r.img); if (idx >= 0) rows[idx] = Object.assign({}, rows[idx], { anchor: sec.id }); }
      if (sec.subtitle) rows.push({ h: lead * 0.3, nb: true }, ...keep(plain(sec.subtitle, { fam: st.body, z: z + 1.5, lead: lead + 2, W: align === 'center' ? fw * 0.8 : fw, x0: align === 'center' ? fw * 0.1 : 0, i: true, align, hy: false })));
      if (c.rule === 'short') rows.push({ h: lead * 1.5, nb: true, ops: [{ t: 'l', x1: fw / 2 - 16, y1: lead * 0.8, x2: fw / 2 + 16, y2: lead * 0.8, c: 0, lw: 0.5 }] });
      else if (c.rule === 'bar') rows.push({ h: lead * 1.2, nb: true, ops: [{ t: 'r', x: 0, y: lead * 0.55, w: fw, h: 1.6, c: 0.1 }] });
      else if (c.rule === 'dots') rows.push({ h: lead * 1.6, nb: true, ops: [-9, 0, 9].map(d => ({ t: 'r', x: fw / 2 + d - 1, y: lead * 0.8, w: 2, h: 2, c: 0.15 })) });
      if (hasImg && place_ === 'below') rows.push({ h: lead * 0.5, nb: true }, ...keep(imageRows(sec.image.id, sec.image.caption, 'full', 0.36, 'chapter').filter(r => !r.space)));
      rows.push({ h: lead * (c.rule === 'none' ? 1.8 : 1), nb: true });
      return rows;
    }
    function flowSection(sec, kind) {
      const img = sec.image && sec.image.id && book.images && book.images[sec.image.id] ? sec.image : null;
      const recto = setup.chapterStart !== 'any' || kind === 'body-first';
      if (img && img.place === 'full') {
        if (recto) { if (pages.length % 2 === 0) blankPage(); }
        const p = newPage('plate'); p.sec = sec;
        const a = book.images[img.id];
        if (setup.fullBleed) { p.ops.push({ t: 'i', x: 0, y: 0, w: W, h: H, img: img.id, fit: 'cover', bleed: true }); placed.push({ id: img.id, w: W + 18, h: H + 18, page: p.index, where: 'chapter-full' }); }
        else { const fx = frameX(p.side); let w = fw, h = w * a.h / a.w; if (h > fh) { h = fh; w = h * a.w / a.h; } p.ops.push({ t: 'i', x: fx + (fw - w) / 2, y: m.top + (fh - h) / 2, w, h, img: img.id }); placed.push({ id: img.id, w, h, page: p.index, where: 'chapter-full' }); }
      } else if (recto) toRecto();
      const p = newPage(kind === 'front' ? 'frontsec' : 'body'); p.opener = true; p.sec = sec;
      place(openerRows(sec).concat(blockRows(sec, { initial: sec.kind === 'chapter' })));
    }
    function putRows(p, rows, x, y) { for (const r of rows) { if (r.ops) for (const o of r.ops) p.ops.push(shift(o, x, y)); y += r.h; } return y; }
    const rowsH = rows => rows.reduce((s, r) => s + r.h, 0);

    /* ---- front matter ---- */
    const tAlign = st.ch.align, title = meta.title || 'Untitled';
    if (front.halfTitle) {
      const p = newPage('display'), fx = frameX(p.side);
      putRows(p, plain(title, { fam: st.head, z: 16, lead: 21, W: fw, b: st.ch.titleB, align: 'center', hy: false }), fx, m.top + fh * 0.26);
    }
    if (front.titlePage !== false) {
      toRecto(); const p = newPage('display'), fx = frameX(p.side);
      const tz = Math.min(34, Math.max(22, fw / 11)); let y = m.top + fh * 0.16;
      y = putRows(p, plain(title, { fam: st.head, z: tz, lead: tz * 1.16, W: fw, b: st.ch.titleB, align: tAlign, hy: false }), fx, y);
      if (meta.subtitle) y = putRows(p, plain(meta.subtitle, { fam: st.body, z: 13.5, lead: 19, W: fw, i: true, align: tAlign, hy: false }), fx, y + 12);
      if (tAlign === 'center') p.ops.push({ t: 'l', x1: fx + fw / 2 - 18, y1: y + 26, x2: fx + fw / 2 + 18, y2: y + 26, c: 0, lw: 0.5 }); else p.ops.push({ t: 'r', x: fx, y: y + 24, w: 44, h: 2, c: 0.1 });
      if (meta.author) putRows(p, plain(meta.author, { fam: st.head, z: 14.5, lead: 20, W: fw, align: tAlign, hy: false }), fx, y + 50);
      if (meta.publisher) { const pr = [{ h: 12, ops: [{ t: 't', x: tAlign === 'center' ? (fw - F(fk(st.head, false, false)).width(meta.publisher.toUpperCase(), 8, 1.6)) / 2 : 0, y: 9, s: meta.publisher.toUpperCase(), f: fk(st.head, false, false), z: 8, ls: 1.6 }] }]; putRows(p, pr, fx, m.top + fh - 14); }
    }
    if (front.copyright !== false) {
      const p = newPage('display'), fx = frameX(p.side), txt = (meta.copyrightText && meta.copyrightText.trim()) ? meta.copyrightText : BF.defaultCopyright(meta), rows = [];
      for (const ln of txt.split('\n')) { if (!ln.trim()) rows.push({ h: 6 }); else rows.push(...paraRows([{ t: ln }], { fam: st.body, z: 8.3, lead: 11.5, W: fw * 0.86, hy: false })); }
      putRows(p, rows, fx, m.top + Math.max(0, fh - rowsH(rows)));
    }
    if (front.dedication && front.dedication.trim()) {
      toRecto(); const p = newPage('display'), fx = frameX(p.side); let y = m.top + fh * 0.26;
      for (const ln of front.dedication.split('\n')) y = ln.trim() ? putRows(p, plain(ln, { fam: st.body, z: z + 0.5, lead: lead + 2, W: fw * 0.7, x0: fw * 0.15, i: true, align: 'center', hy: false }), fx, y) : y + lead;
    }
    if (front.epigraph && front.epigraph.trim()) {
      toRecto(); const p = newPage('display'), fx = frameX(p.side); let y = m.top + fh * 0.24;
      for (const ln of front.epigraph.split('\n')) y = ln.trim() ? putRows(p, plain(ln, { fam: st.body, z, lead: lead + 1, W: fw * 0.68, x0: fw * 0.16, i: true, hy: false }), fx, y) : y + lead * 0.6;
      if (front.epigraphSource) putRows(p, plain('— ' + front.epigraphSource, { fam: st.body, z: z - 1, lead, W: fw * 0.68, x0: fw * 0.16, align: 'right', hy: false }), fx, y + 6);
    }
    const ordered = BF.orderedSections(book), tocModel = [];
    for (const s of ordered) {
      tocModel.push({ key: s.id, level: 1, num: s.kind === 'chapter' ? nums.get(s.id) : null, title: s.title || 'Untitled' });
      if (front.tocSections) for (const blk of s.blocks || []) {
        if (blk.type === 'h' && (blk.level || 2) === 2) tocModel.push({ key: blk.id, level: 2, title: blk.text });
        else if (blk.type === 'text') { let hn = 0; for (const sub of BF.parseText(blk.md)) if (sub.k === 'h') { if (sub.level === 2) tocModel.push({ key: blk.id + '#' + hn, level: 2, title: sub.text }); hn++; } }
      }
    }
    if (front.toc !== false && tocModel.length) {
      toRecto(); const p = newPage('frontsec'); p.opener = true; p.toc = true; p.sec = { title: front.tocTitle || 'Contents' };
      const c = st.ch, rows = [{ h: fh * Math.min(0.1, c.drop), nb: true }];
      rows.push(...keep(plain(front.tocTitle || 'Contents', { fam: st.head, z: Math.min(22, c.titleZ), lead: 28, W: fw, b: c.titleB, align: c.align, hy: false })), { h: lead * 1.6, nb: true });
      const numW = 26, dotF = fk(st.body, false, false), dz = z - 0.5, step = 4.6, dw = F(dotF).width('.', dz);
      for (const e of tocModel) {
        const l2 = e.level === 2, ez = l2 ? z - 1 : z, el = l2 ? lead - 1 : lead + 2, ind = l2 ? z * 2.4 : (e.num ? z * 2.2 : 0);
        if (!l2) rows.push(sp(lead * 0.3));
        const lab = labels ? (labels.get(e.key) || '') : '000';
        const pr = paraRows([{ t: doSmart ? BF.smart(e.title) : e.title }], { fam: st.body, z: ez, lead: el, W: fw - numW - ind - 8, x0: ind, b: false, hy: false, loose: true });
        pr.forEach((r, n) => {
          const ops = r.ops.slice(), by = el / 2 + ez * 0.34;
          if (n === 0 && e.num && !l2) ops.unshift({ t: 't', x: 0, y: by, s: String(e.num), f: fk(st.body, true, false), z: ez });
          if (n === pr.length - 1) {
            const lastOp = r.ops[r.ops.length - 1], endX = lastOp ? lastOp.x + F(lastOp.f).width(lastOp.s, lastOp.z) : ind;
            const lw = F(fk(st.body, false, false)).width(lab, ez);
            let dots = ''; for (let gx = fw - numW - 4; gx - step > endX + 5; gx -= step) dots += '.';
            if (dots.length > 1) ops.push({ t: 't', x: fw - numW - 4 - dots.length * step, y: by, s: dots, f: dotF, z: dz, ls: step - dw, c: 0.45 });
            ops.push({ t: 't', x: fw - lw, y: by, s: lab, f: fk(st.body, false, false), z: ez });
          }
          rows.push({ h: el, ops, nb: n < pr.length - 1 });
        });
      }
      place(rows);
    }
    for (const s of ordered) if (s.kind === 'front') flowSection(s, 'front');
    toRecto(); bodyStart = pages.length;
    let firstBody = true;
    for (const s of ordered) if (s.kind !== 'front') { flowSection(s, firstBody ? 'body-first' : 'body'); firstBody = false; }
    if (cur) commit(cur);
    if (pages.length % 2 === 1) { blankPage(); commit(cur); }
    for (const p of pages) commit(p);

    /* ---- running heads and folios ---- */
    const headY = m.top - 0.24 * IN, footY = H - m.bottom + 0.3 * IN;
    const labelOf = idx => idx < bodyStart ? BF.roman(idx + 1) : String(idx - bodyStart + 1);
    let lastSec = null;
    for (const p of pages) {
      p.label = labelOf(p.index);
      if (p.sec) lastSec = p.sec; else if (p.kind === 'body' || p.kind === 'frontsec') p.sec = lastSec;
      if (p.blank || p.kind === 'display' || p.kind === 'plate') continue;
      const fx = frameX(p.side), hf = fk(st.head, false, false), bf = fk(st.body, false, false);
      const outside = (s, f, zz, ls) => p.side === 'l' ? fx : fx + fw - F(f).width(s, zz, ls) + (ls || 0);
      let folioAt = st.folio;
      if (p.opener && folioAt === 'head') folioAt = 'bottom-outside';
      if (!p.opener && st.run !== 'none' && p.kind === 'body') {
        let text = p.side === 'l' ? title : (p.sec && p.sec.title) || title;
        text = doSmart ? BF.smart(text) : text;
        const caps = st.run !== 'center', f = st.run === 'center' ? fk(st.body, false, true) : st.run === 'outside' ? hf : bf, zz = st.run === 'center' ? 8.6 : 7, ls = caps ? 1 : 0;
        if (caps) text = text.toUpperCase();
        const maxW = fw * (folioAt === 'head' ? 0.78 : 0.86);
        while (text.length > 4 && F(f).width(text, zz, ls) > maxW) text = text.slice(0, -2).trimEnd() + '…';
        const tw = F(f).width(text, zz, ls) - ls;
        if (st.run === 'outside') {
          const gap = folioAt === 'head' ? F(fk(st.head, true, false)).width(p.label, 8) + 12 : 0;
          p.ops.push({ t: 't', x: p.side === 'l' ? fx + gap : fx + fw - gap - tw, y: headY, s: text, f, z: zz, ls, c: 0.3 });
        } else p.ops.push({ t: 't', x: fx + (fw - tw) / 2, y: headY, s: text, f, z: zz, ls, c: 0.2 });
        p.headTop = headY - zz * 0.75;
      }
      if (folioAt === 'head') { const f = fk(st.head, true, false); p.ops.push({ t: 't', x: outside(p.label, f, 8), y: headY, s: p.label, f, z: 8 }); p.headTop = headY - 6; }
      else if (folioAt === 'bottom-outside') { const f = fk(st.head, true, false); p.ops.push({ t: 't', x: outside(p.label, f, 8.5), y: footY, s: p.label, f, z: 8.5 }); p.footBottom = footY; }
      else { const zz = Math.max(8.5, z - 1.5); p.ops.push({ t: 't', x: fx + (fw - F(bf).width(p.label, zz)) / 2, y: footY, s: p.label, f: bf, z: zz }); p.footBottom = footY; }
    }
    return { pages, anchors, placed, notes, bodyStart, tocModel, labelOf, geo, style: st, frame: { w: fw, h: fh }, headY, footY };
  }

  BF.wordCount = function (book) {
    let n = 0;
    for (const s of book.sections) for (const b of s.blocks || []) n += ((b.md || b.text || '').match(/\S+/g) || []).length;
    return n;
  };
  BF.layoutBook = function (book) {
    BF.resetMissing();
    const setup = book.setup; let est = Math.max(24, Math.round(BF.wordCount(book) / 280) + 10), geo = BF.geometry(setup, est), res = null;
    for (let it = 0; it < 3; it++) {
      const first = layoutInterior(book, geo, null);
      const labels = new Map(); for (const [k, idx] of first.anchors) labels.set(k, first.labelOf(idx));
      res = layoutInterior(book, geo, labels);
      const g2 = BF.geometry(setup, res.pages.length);
      if (g2.m.inside <= geo.m.inside + 0.01) { res.geo = Object.assign({}, geo, { need: g2.need }); break; }
      geo = g2;
    }
    res.missing = BF.collectMissing();
    res.pageCount = res.pages.length;
    res.words = BF.wordCount(book);
    return res;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
