/* Book Formatter core: bytes, zip, font parsing, hyphenation, PDF writer. No DOM. */
(function (G) {
  'use strict';
  const BF = G.BF = G.BF || {};
  const te = new TextEncoder(), td = new TextDecoder();
  BF.utf8 = s => te.encode(s);
  BF.fromUtf8 = u => td.decode(u);
  BF.concat = function (chunks) {
    let n = 0; for (const c of chunks) n += c.length;
    const out = new Uint8Array(n); let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  };
  BF.b64ToBytes = function (s) {
    const b = atob(s), u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  };
  BF.bytesToB64 = function (u) {
    let s = ''; const CH = 0x8000;
    for (let i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH));
    return btoa(s);
  };
  async function pipe(u8, t) {
    const rs = new Blob([u8]).stream().pipeThrough(t);
    return new Uint8Array(await new Response(rs).arrayBuffer());
  }
  BF.deflate = u => pipe(u, new CompressionStream('deflate'));
  BF.deflateRaw = u => pipe(u, new CompressionStream('deflate-raw'));
  BF.inflateRaw = u => pipe(u, new DecompressionStream('deflate-raw'));
  BF.esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  BF.uid = () => Math.random().toString(36).slice(2, 10);

  /* ---------- zip ---------- */
  const CRCT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  BF.crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRCT[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  BF.zip = async function (files) {
    const parts = [], central = []; let off = 0;
    for (const f of files) {
      const data = typeof f.data === 'string' ? te.encode(f.data) : f.data;
      const name = te.encode(f.name), crc = BF.crc32(data);
      const flag = /[^\x00-\x7f]/.test(f.name) ? 0x0800 : 0;
      let comp = data, method = 0;
      if (!f.store && data.length > 64) { const d = await BF.deflateRaw(data); if (d.length < data.length) { comp = d; method = 8; } }
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, flag, true); lh.setUint16(8, method, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, comp.length, true);
      lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, comp);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, flag, true);
      ch.setUint16(10, method, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, comp.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + comp.length;
    }
    let csize = 0; for (const c of central) csize += c.length;
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return BF.concat([...parts, ...central, new Uint8Array(e.buffer)]);
  };
  BF.unzip = function (u) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    let e = u.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('This file is not a valid .docx (zip) file.');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
    for (let i = 0; i < n; i++) {
      const method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true),
        xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = td.decode(u.subarray(p + 46, p + 46 + nl));
      const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
      const raw = u.subarray(start, start + csz);
      out[name] = { bytes: async () => method === 0 ? raw.slice() : await BF.inflateRaw(raw) };
      p += 46 + nl + xl + cl;
    }
    return out;
  };

  /* ---------- fonts ---------- */
  class Font {
    constructor(key, bytes) {
      this.key = key; this.bytes = bytes; this.missing = new Set(); this.wc = new Map();
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const nT = dv.getUint16(4), T = {};
      for (let i = 0; i < nT; i++) {
        const o = 12 + i * 16;
        T[String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3])] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12) };
      }
      const head = T.head.off, hhea = T.hhea.off;
      this.upm = dv.getUint16(head + 18);
      this.bbox = [dv.getInt16(head + 36), dv.getInt16(head + 38), dv.getInt16(head + 40), dv.getInt16(head + 42)];
      this.ascent = dv.getInt16(hhea + 4); this.descent = dv.getInt16(hhea + 6);
      const nHM = dv.getUint16(hhea + 34);
      this.numGlyphs = dv.getUint16(T.maxp.off + 4);
      this.adv = new Uint16Array(this.numGlyphs);
      let last = 0;
      for (let g = 0; g < this.numGlyphs; g++) { if (g < nHM) last = dv.getUint16(T.hmtx.off + g * 4); this.adv[g] = last; }
      this.capHeight = Math.round(this.upm * 0.7); this.xHeight = Math.round(this.upm * 0.48);
      if (T['OS/2']) {
        const o = T['OS/2'].off, ver = dv.getUint16(o);
        if (ver >= 2 && T['OS/2'].len >= 90) { this.xHeight = dv.getInt16(o + 86) || this.xHeight; this.capHeight = dv.getInt16(o + 88) || this.capHeight; }
      }
      this.italicAngle = T.post ? dv.getInt32(T.post.off + 4) / 65536 : 0;
      this.cmap = new Map();
      const cm = T.cmap.off, nSub = dv.getUint16(cm + 2); let best = null, bestScore = -1;
      for (let i = 0; i < nSub; i++) {
        const pid = dv.getUint16(cm + 4 + i * 8), eid = dv.getUint16(cm + 6 + i * 8), so = cm + dv.getUint32(cm + 8 + i * 8);
        const fmt = dv.getUint16(so);
        let score = -1;
        if (fmt === 12 && ((pid === 3 && eid === 10) || pid === 0)) score = 3;
        else if (fmt === 4 && ((pid === 3 && eid === 1) || pid === 0)) score = 2;
        if (score > bestScore) { bestScore = score; best = { so, fmt }; }
      }
      if (!best) throw new Error('Font ' + key + ' has no usable character map');
      if (best.fmt === 12) {
        const nG = dv.getUint32(best.so + 12);
        for (let i = 0; i < nG; i++) {
          const o = best.so + 16 + i * 12, s = dv.getUint32(o), e = dv.getUint32(o + 4), g = dv.getUint32(o + 8);
          for (let c = s; c <= e; c++) this.cmap.set(c, g + c - s);
        }
      } else {
        const so = best.so, seg = dv.getUint16(so + 6) / 2;
        for (let i = 0; i < seg; i++) {
          const end = dv.getUint16(so + 14 + i * 2), start = dv.getUint16(so + 16 + seg * 2 + i * 2),
            delta = dv.getInt16(so + 16 + seg * 4 + i * 2), roPos = so + 16 + seg * 6 + i * 2, ro = dv.getUint16(roPos);
          for (let c = start; c <= end && c < 0xFFFF; c++) {
            let g;
            if (ro === 0) g = (c + delta) & 0xFFFF;
            else { g = dv.getUint16(roPos + ro + 2 * (c - start)); if (g) g = (g + delta) & 0xFFFF; }
            if (g) this.cmap.set(c, g);
          }
        }
      }
      this.kern = null;
      if (T.kern) {
        const k = T.kern.off, nt = dv.getUint16(k + 2); let p = k + 4;
        if (nt > 0 && (dv.getUint16(p + 4) >> 8) === 0) {
          const nP = dv.getUint16(p + 6); this.kern = new Map(); p += 14;
          for (let i = 0; i < nP; i++, p += 6) this.kern.set(dv.getUint16(p) * 65536 + dv.getUint16(p + 2), dv.getInt16(p + 4));
        }
      }
      this.psName = 'BF-' + key;
      this.mono = /^mono/.test(key);
      this.bold = /-b/.test(key); this.italic = /i$/.test(key);
      this.space = this.adv[this.cmap.get(32) || 0];
    }
    gid(cp) { const g = this.cmap.get(cp); if (g === undefined) { if (cp > 31) this.missing.add(cp); return 0; } return g; }
    units(str) {
      let c = this.wc.get(str); if (c !== undefined) return c;
      let w = 0, prev = -1;
      for (const ch of str) {
        const g = this.gid(ch.codePointAt(0)); w += this.adv[g];
        if (prev >= 0 && this.kern) { const k = this.kern.get(prev * 65536 + g); if (k) w += k; }
        prev = g;
      }
      if (this.wc.size > 200000) this.wc.clear();
      this.wc.set(str, w); return w;
    }
    width(str, size, ls) { return this.units(str) * size / this.upm + (ls ? ls * Array.from(str).length : 0); }
    has(cp) { return this.cmap.has(cp); }
  }
  BF.Font = Font;
  const fontCache = new Map();
  BF.onFontLoad = null;
  BF.getFont = function (key) {
    let f = fontCache.get(key);
    if (!f) {
      let k = key;
      if (!BF.FONT_B64[k]) k = key.replace(/-bi$/, '-b').replace(/-i$/, '-r');
      if (!BF.FONT_B64[k]) throw new Error('Unknown font ' + key);
      f = fontCache.get(k);
      if (!f) { f = new Font(k, BF.b64ToBytes(BF.FONT_B64[k])); fontCache.set(k, f); if (BF.onFontLoad) BF.onFontLoad(f); }
      fontCache.set(key, f);
    }
    return f;
  };
  BF.fontKey = (fam, b, i) => fam + '-' + (b && i ? 'bi' : b ? 'b' : i ? 'i' : 'r');
  BF.resetMissing = () => { for (const f of fontCache.values()) f.missing.clear(); };
  BF.collectMissing = () => { const s = new Set(); for (const f of fontCache.values()) for (const c of f.missing) s.add(c); return s; };

  /* ---------- hyphenation (Liang) ---------- */
  let hyMap = null, hyExc = null, hyMax = 0; const hyCache = new Map();
  function hyInit() {
    hyMap = new Map(); hyExc = new Map();
    for (const p of BF.HYPH_PAT.split(' ')) {
      let key = ''; const pts = [0];
      for (const ch of p) { if (ch >= '0' && ch <= '9') pts[pts.length - 1] = +ch; else { key += ch; pts.push(0); } }
      hyMap.set(key, pts); if (key.length > hyMax) hyMax = key.length;
    }
    for (const w of BF.HYPH_EXC.split(' ')) {
      const pos = []; let n = 0;
      for (const ch of w) { if (ch === '-') pos.push(n); else n++; }
      hyExc.set(w.replace(/-/g, ''), pos);
    }
  }
  BF.hyphenate = function (word) {
    if (!hyMap) hyInit();
    const lw = word.toLowerCase();
    let r = hyCache.get(lw); if (r) return r;
    if (hyExc.has(lw)) r = hyExc.get(lw);
    else {
      const w = '.' + lw + '.', sc = new Uint8Array(w.length + 1);
      for (let i = 0; i < w.length; i++) for (let len = 1; len <= hyMax && i + len <= w.length; len++) {
        const p = hyMap.get(w.substr(i, len));
        if (p) for (let k = 0; k < p.length; k++) if (p[k] > sc[i + k]) sc[i + k] = p[k];
      }
      r = [];
      for (let i = 2; i <= lw.length - 3; i++) if (sc[i + 1] & 1) r.push(i);
    }
    if (hyCache.size > 50000) hyCache.clear();
    hyCache.set(lw, r); return r;
  };

  /* ---------- PDF writer ---------- */
  const n3 = v => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };
  const pdfStr = s => { let h = 'FEFF'; for (let i = 0; i < s.length; i++) h += s.charCodeAt(i).toString(16).padStart(4, '0'); return '<' + h.toUpperCase() + '>'; };
  function colOp(c, stroke) {
    if (typeof c === 'number') return n3(c) + (stroke ? ' G' : ' g');
    if (c[0] === c[1] && c[1] === c[2]) return n3(c[0]) + (stroke ? ' G' : ' g');
    return n3(c[0]) + ' ' + n3(c[1]) + ' ' + n3(c[2]) + (stroke ? ' RG' : ' rg');
  }
  class PDF {
    constructor() { this.objs = [null]; this.fonts = new Map(); this.images = new Map(); this.pages = []; this.pagesId = this.alloc(); this.resId = this.alloc(); }
    alloc() { this.objs.push(null); return this.objs.length - 1; }
    put(id, head, stream) { this.objs[id] = { head, stream: stream || null }; }
    async stream(dict, data, id) {
      const d = await BF.deflate(data);
      id = id || this.alloc();
      this.put(id, '<< ' + dict + ' /Filter /FlateDecode /Length ' + d.length + ' >>', d);
      return id;
    }
    fontRef(font) {
      let r = this.fonts.get(font.key);
      if (!r) { r = { name: 'F' + (this.fonts.size + 1), font, used: new Map() }; this.fonts.set(font.key, r); }
      return r;
    }
    imageRef(key, img) {
      let r = this.images.get(key);
      if (!r) { r = { name: 'Im' + (this.images.size + 1), img, id: this.alloc() }; this.images.set(key, r); }
      return r;
    }
    /* ops use a top-left origin in points; (dx,dy) shifts them inside a taller/wider media box */
    content(ops, H, dx, dy, imgs) {
      const out = []; let fill = null, inText = false, curF = null;
      const endText = () => { if (inText) { out.push('ET'); inText = false; curF = null; } };
      const setFill = c => { const s = colOp(c, false); if (s !== fill) { out.push(s); fill = s; } };
      for (const o of ops) {
        if (o.t === 't') {
          if (!o.s) continue;
          const fr = this.fontRef(BF.getFont(o.f)), font = fr.font;
          if (!inText) { out.push('BT'); inText = true; }
          setFill(o.c == null ? 0 : o.c);
          const fk = fr.name + '/' + o.z;
          if (fk !== curF) { out.push('/' + fr.name + ' ' + n3(o.z) + ' Tf'); curF = fk; }
          out.push(n3(o.ls || 0) + ' Tc');
          const x = o.x + dx, y = H - (o.y + dy);
          if (o.rot === 90) out.push('0 -1 1 0 ' + n3(x) + ' ' + n3(y) + ' Tm');
          else out.push('1 0 0 1 ' + n3(x) + ' ' + n3(y) + ' Tm');
          let hex = '', arr = [], prev = -1, kerned = false;
          for (const ch of o.s) {
            const cp = ch.codePointAt(0), g = font.gid(cp);
            if (!fr.used.has(g)) fr.used.set(g, cp);
            if (prev >= 0 && font.kern) {
              const k = font.kern.get(prev * 65536 + g);
              if (k) { arr.push('<' + hex + '>', n3(-k * 1000 / font.upm)); hex = ''; kerned = true; }
            }
            hex += g.toString(16).padStart(4, '0'); prev = g;
          }
          if (kerned) { arr.push('<' + hex + '>'); out.push('[' + arr.join(' ') + '] TJ'); }
          else out.push('<' + hex + '> Tj');
        } else {
          endText();
          if (o.t === 'r') { setFill(o.c); out.push(n3(o.x + dx) + ' ' + n3(H - (o.y + dy) - o.h) + ' ' + n3(o.w) + ' ' + n3(o.h) + ' re f'); }
          else if (o.t === 'sr') { out.push(n3(o.lw || 0.5) + ' w ' + colOp(o.c, true) + ' ' + n3(o.x + dx) + ' ' + n3(H - (o.y + dy) - o.h) + ' ' + n3(o.w) + ' ' + n3(o.h) + ' re S'); }
          else if (o.t === 'l') { out.push(n3(o.lw || 0.5) + ' w ' + colOp(o.c, true) + ' ' + n3(o.x1 + dx) + ' ' + n3(H - (o.y1 + dy)) + ' m ' + n3(o.x2 + dx) + ' ' + n3(H - (o.y2 + dy)) + ' l S'); }
          else if (o.t === 'i') {
            const im = imgs && imgs[o.img]; if (!im) continue;
            const ir = this.imageRef(o.img + (im.variant || ''), im);
            const bx = o.x + dx, by = H - (o.y + dy) - o.h;
            let w = o.w, h = o.h, ix = bx, iy = by;
            if (o.fit === 'cover') {
              const s = Math.max(o.w / im.pw, o.h / im.ph); w = im.pw * s; h = im.ph * s;
              ix = bx - (w - o.w) / 2; iy = by - (h - o.h) / 2;
              out.push('q ' + n3(bx) + ' ' + n3(by) + ' ' + n3(o.w) + ' ' + n3(o.h) + ' re W n');
              out.push(n3(w) + ' 0 0 ' + n3(h) + ' ' + n3(ix) + ' ' + n3(iy) + ' cm /' + ir.name + ' Do Q');
            } else out.push('q ' + n3(w) + ' 0 0 ' + n3(h) + ' ' + n3(ix) + ' ' + n3(iy) + ' cm /' + ir.name + ' Do Q');
          }
        }
      }
      endText();
      return out.join('\n');
    }
    addPage(mediaW, mediaH, trim, contentStr) { this.pages.push({ w: mediaW, h: mediaH, trim, content: contentStr }); }
    async build(info) {
      for (const fr of this.fonts.values()) {
        const f = fr.font, sc = 1000 / f.upm;
        const ff = await this.stream('/Length1 ' + f.bytes.length, f.bytes);
        const desc = this.alloc();
        const flags = (f.mono ? 1 : 0) | 32 | (f.italic ? 64 : 0);
        this.put(desc, '<< /Type /FontDescriptor /FontName /' + f.psName + ' /Flags ' + flags + ' /FontBBox [' + f.bbox.map(v => Math.round(v * sc)).join(' ') + '] /ItalicAngle ' + n3(f.italicAngle) + ' /Ascent ' + Math.round(f.ascent * sc) + ' /Descent ' + Math.round(f.descent * sc) + ' /CapHeight ' + Math.round(f.capHeight * sc) + ' /StemV ' + (f.bold ? 140 : 80) + ' /FontFile2 ' + ff + ' 0 R >>');
        const W = []; for (let g = 0; g < f.numGlyphs; g++) W.push(Math.round(f.adv[g] * sc));
        const cid = this.alloc();
        this.put(cid, '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /' + f.psName + ' /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ' + desc + ' 0 R /DW 1000 /W [0 [' + W.join(' ') + ']] /CIDToGIDMap /Identity >>');
        const ents = [...fr.used.entries()].filter(e => e[0] > 0).sort((a, b) => a[0] - b[0]);
        let cm = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
        for (let i = 0; i < ents.length; i += 100) {
          const ch = ents.slice(i, i + 100);
          cm += ch.length + ' beginbfchar\n';
          for (const [g, cp] of ch) {
            let u;
            if (cp > 0xFFFF) { const v = cp - 0x10000; u = (0xD800 + (v >> 10)).toString(16).padStart(4, '0') + (0xDC00 + (v & 0x3FF)).toString(16).padStart(4, '0'); }
            else u = cp.toString(16).padStart(4, '0');
            cm += '<' + g.toString(16).padStart(4, '0') + '> <' + u + '>\n';
          }
          cm += 'endbfchar\n';
        }
        cm += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
        const tu = await this.stream('', te.encode(cm));
        fr.id = this.alloc();
        this.put(fr.id, '<< /Type /Font /Subtype /Type0 /BaseFont /' + f.psName + ' /Encoding /Identity-H /DescendantFonts [' + cid + ' 0 R] /ToUnicode ' + tu + ' 0 R >>');
      }
      for (const ir of this.images.values()) {
        const im = ir.img;
        if (im.kind === 'jpeg') {
          const cs = im.comps === 1 ? '/DeviceGray' : im.comps === 4 ? '/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]' : '/DeviceRGB';
          this.put(ir.id, '<< /Type /XObject /Subtype /Image /Width ' + im.pw + ' /Height ' + im.ph + ' /ColorSpace ' + cs + ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>', im.bytes);
        } else {
          await this.stream('/Type /XObject /Subtype /Image /Width ' + im.pw + ' /Height ' + im.ph + ' /ColorSpace ' + (im.kind === 'gray' ? '/DeviceGray' : '/DeviceRGB') + ' /BitsPerComponent 8', im.bytes, ir.id);
        }
      }
      let res = '<< /ProcSet [/PDF /Text /ImageB /ImageC]';
      if (this.fonts.size) res += ' /Font << ' + [...this.fonts.values()].map(r => '/' + r.name + ' ' + r.id + ' 0 R').join(' ') + ' >>';
      if (this.images.size) res += ' /XObject << ' + [...this.images.values()].map(r => '/' + r.name + ' ' + r.id + ' 0 R').join(' ') + ' >>';
      this.put(this.resId, res + ' >>');
      const kids = [];
      for (const p of this.pages) {
        const cid = await this.stream('', te.encode(p.content));
        const pid = this.alloc(); kids.push(pid);
        const t = p.trim;
        this.put(pid, '<< /Type /Page /Parent ' + this.pagesId + ' 0 R /MediaBox [0 0 ' + n3(p.w) + ' ' + n3(p.h) + '] /BleedBox [0 0 ' + n3(p.w) + ' ' + n3(p.h) + '] /TrimBox [' + t.map(n3).join(' ') + '] /Resources ' + this.resId + ' 0 R /Contents ' + cid + ' 0 R >>');
      }
      this.put(this.pagesId, '<< /Type /Pages /Count ' + kids.length + ' /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] >>');
      const cat = this.alloc();
      this.put(cat, '<< /Type /Catalog /Pages ' + this.pagesId + ' 0 R >>');
      const inf = this.alloc();
      const d = new Date(), z = n => String(n).padStart(2, '0');
      const ds = 'D:' + d.getUTCFullYear() + z(d.getUTCMonth() + 1) + z(d.getUTCDate()) + z(d.getUTCHours()) + z(d.getUTCMinutes()) + z(d.getUTCSeconds()) + 'Z';
      this.put(inf, '<< /Title ' + pdfStr(info.title || '') + ' /Author ' + pdfStr(info.author || '') + ' /Creator ' + pdfStr('Book Formatter') + ' /Producer ' + pdfStr('Book Formatter PDF writer') + ' /CreationDate (' + ds + ') /ModDate (' + ds + ') /Trapped /False >>');
      const chunks = [], offs = [0]; let pos = 0;
      const push = u => { chunks.push(u); pos += u.length; };
      push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
      for (let i = 1; i < this.objs.length; i++) {
        const o = this.objs[i]; offs[i] = pos;
        if (!o) { push(te.encode(i + ' 0 obj\nnull\nendobj\n')); continue; }
        push(te.encode(i + ' 0 obj\n' + o.head + '\n'));
        if (o.stream) { push(te.encode('stream\n')); push(o.stream); push(te.encode('\nendstream\n')); }
        push(te.encode('endobj\n'));
      }
      const xref = pos; let x = 'xref\n0 ' + this.objs.length + '\n0000000000 65535 f \n';
      for (let i = 1; i < this.objs.length; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
      let id = ''; for (let i = 0; i < 32; i++) id += Math.floor(Math.random() * 16).toString(16);
      x += 'trailer\n<< /Size ' + this.objs.length + ' /Root ' + cat + ' 0 R /Info ' + inf + ' 0 R /ID [<' + id + '> <' + id + '>] >>\nstartxref\n' + xref + '\n%%EOF\n';
      push(te.encode(x));
      return BF.concat(chunks);
    }
  }
  BF.PDF = PDF;

  /* JPEG header: size and component count (null if not a baseline/progressive JPEG) */
  BF.jpegInfo = function (u) {
    if (u[0] !== 0xFF || u[1] !== 0xD8) return null;
    let p = 2;
    while (p + 9 < u.length) {
      if (u[p] !== 0xFF) { p++; continue; }
      const m = u[p + 1];
      if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01 || m === 0xFF) { p += 2; continue; }
      const len = (u[p + 2] << 8) | u[p + 3];
      if ((m >= 0xC0 && m <= 0xC3) || (m >= 0xC5 && m <= 0xC7) || (m >= 0xC9 && m <= 0xCB) || (m >= 0xCD && m <= 0xCF))
        return { h: (u[p + 5] << 8) | u[p + 6], w: (u[p + 7] << 8) | u[p + 8], comps: u[p + 9] };
      p += 2 + len;
    }
    return null;
  };
  BF.pngInfo = function (u) {
    if (u[0] !== 0x89 || u[1] !== 0x50) return null;
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
