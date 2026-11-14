/* Wrap cover: back + spine + front in one sheet, sized from page count and the store's paper. */
(function (G) {
  'use strict';
  const BF = G.BF, IN = 72, fk = BF.fontKey, F = BF.getFont;
  BF.hex = function (h) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return [0, 0, 0];
    const n = parseInt(m[1], 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  BF.COVER_TEMPLATES = {
    band: { label: 'Bar', blurb: 'Left-set title under an accent bar.' },
    classic: { label: 'Frame', blurb: 'Centred title inside a thin frame.' },
    split: { label: 'Split', blurb: 'Picture or colour field on top, title below.' },
    type: { label: 'Big type', blurb: 'Title words stacked edge to edge.' }
  };
  function fit(str, fontKey, maxW, maxH, zMax, zMin, lm) {
    for (let z = zMax; z >= zMin; z -= 1) {
      const lines = BF.wrapPlain(str, fontKey, z, maxW), Fo = F(fontKey);
      if (lines.length * z * lm <= maxH && lines.every(l => Fo.width(l, z) <= maxW)) return { z, lines };
    }
    return { z: zMin, lines: BF.wrapPlain(str, fontKey, zMin, maxW) };
  }
  function textBlock(ops, lines, fontKey, z, x, y, w, align, c, lm, ls) {
    const Fo = F(fontKey);
    for (const ln of lines) {
      const tw = Fo.width(ln, z, ls || 0) - (ls || 0);
      ops.push({ t: 't', x: align === 'center' ? x + (w - tw) / 2 : align === 'right' ? x + w - tw : x, y: y + z * 0.8, s: ln, f: fontKey, z, c, ls: ls || 0 });
      y += z * lm;
    }
    return y;
  }
  /* Front panel. R is the trimmed panel; ext says how far backgrounds run past it (bleed). */
  function frontPanel(ops, book, R, ext) {
    const c = book.cover || {}, meta = book.meta, bg = BF.hex(c.bg), fg = BF.hex(c.fg), ac = BF.hex(c.accent);
    const tf = c.titleFont || 'poppins', serif = BF.FONT_FAMILIES[tf] && BF.FONT_FAMILIES[tf].kind === 'serif';
    const title = BF.smart(meta.title || 'Untitled'), sub = BF.smart(meta.subtitle || ''), author = BF.smart(meta.author || '');
    const img = c.frontImage && book.images && book.images[c.frontImage] ? c.frontImage : null;
    const E = { x: R.x - ext.l, y: R.y - ext.t, w: R.w + ext.l + ext.r, h: R.h + ext.t + ext.b };
    const tpl = BF.COVER_TEMPLATES[c.template] ? c.template : 'band';
    ops.push({ t: 'r', x: E.x, y: E.y, w: E.w, h: E.h, c: bg });
    if (img && c.frontImageMode === 'full') {
      ops.push({ t: 'i', x: E.x, y: E.y, w: E.w, h: E.h, img, fit: 'cover' });
      if (!c.overlayText) return;
    }
    const mx = R.w * 0.1, tw = R.w - 2 * mx, x = R.x + mx;
    const aZ = Math.max(9, R.w * 0.034), sZ = Math.max(10, R.w * 0.036);
    if (tpl === 'classic') {
      const ins = Math.max(0.3 * IN, R.w * 0.055);
      if (!(img && c.frontImageMode === 'full')) ops.push({ t: 'sr', x: R.x + ins, y: R.y + ins, w: R.w - 2 * ins, h: R.h - 2 * ins, c: ac, lw: 1.1 });
      const f = fk(tf, !serif, false), ft = fit(title, f, tw * 0.9, R.h * 0.34, R.w * 0.11, 14, 1.14);
      let y = textBlock(ops, ft.lines, f, ft.z, x + tw * 0.05, R.y + R.h * 0.2, tw * 0.9, 'center', fg, 1.14);
      ops.push({ t: 'r', x: R.x + R.w / 2 - 20, y: y + ft.z * 0.3, w: 40, h: 1.4, c: ac });
      if (sub) textBlock(ops, BF.wrapPlain(sub, fk(tf, false, true), sZ * 1.05, tw * 0.8), fk(tf, false, true), sZ * 1.05, x + tw * 0.1, y + ft.z * 0.3 + 16, tw * 0.8, 'center', fg, 1.35);
      if (author) textBlock(ops, [author.toUpperCase()], fk(tf, false, false), aZ, x, R.y + R.h * 0.84, tw, 'center', fg, 1.2, aZ * 0.18);
    } else if (tpl === 'split') {
      const sh = R.h * 0.56;
      if (img && c.frontImageMode !== 'full') ops.push({ t: 'i', x: E.x, y: E.y, w: E.w, h: sh + ext.t, img, fit: 'cover' });
      else if (!img) ops.push({ t: 'r', x: E.x, y: E.y, w: E.w, h: sh + ext.t, c: ac });
      const f = fk(tf, true, false), ft = fit(title, f, tw, R.h * 0.22, R.w * 0.095, 13, 1.1);
      let y = textBlock(ops, ft.lines, f, ft.z, x, R.y + sh + R.h * 0.045, tw, 'left', fg, 1.1);
      if (sub) y = textBlock(ops, BF.wrapPlain(sub, fk(tf, false, false), sZ, tw), fk(tf, false, false), sZ, x, y + 6, tw, 'left', fg, 1.32);
      if (author) textBlock(ops, [author.toUpperCase()], fk(tf, true, false), aZ, x, R.y + R.h * 0.92, tw, 'left', ac, 1.2, aZ * 0.14);
    } else if (tpl === 'type') {
      const f = fk(tf, true, false), words = title.toUpperCase().split(/\s+/).filter(Boolean), Fo = F(f);
      let y = R.y + R.h * 0.09; const maxH = R.h * 0.62, per = maxH / Math.max(1, words.length);
      for (const w of words) {
        const zz = Math.min(per / 0.9, tw / (Fo.width(w, 100) / 100));
        ops.push({ t: 't', x, y: y + zz * 0.74, s: w, f, z: zz, c: fg }); y += zz * 0.9;
      }
      ops.push({ t: 'r', x, y: y + 8, w: tw, h: 3, c: ac });
      if (sub) textBlock(ops, BF.wrapPlain(sub, fk(tf, false, false), sZ, tw), fk(tf, false, false), sZ, x, y + 22, tw, 'left', fg, 1.32);
      if (author) textBlock(ops, [author.toUpperCase()], fk(tf, true, false), aZ, x, R.y + R.h * 0.92, tw, 'left', fg, 1.2, aZ * 0.14);
    } else {
      ops.push({ t: 'r', x, y: R.y + R.h * 0.13, w: R.w * 0.18, h: R.h * 0.012, c: ac });
      const f = fk(tf, true, false), ft = fit(title, f, tw, R.h * 0.36, R.w * 0.115, 14, 1.08);
      let y = textBlock(ops, ft.lines, f, ft.z, x, R.y + R.h * 0.17, tw, 'left', fg, 1.08);
      if (sub) textBlock(ops, BF.wrapPlain(sub, fk(tf, false, false), sZ * 1.05, tw * 0.9), fk(tf, false, false), sZ * 1.05, x, y + 10, tw * 0.9, 'left', fg, 1.34);
      if (author) textBlock(ops, [author.toUpperCase()], fk(tf, true, false), aZ, x, R.y + R.h * 0.9, tw, 'left', ac, 1.2, aZ * 0.14);
    }
  }
  BF.frontCoverOps = function (book, w, h) { const ops = []; frontPanel(ops, book, { x: 0, y: 0, w, h }, { l: 0, r: 0, t: 0, b: 0 }); return ops; };

  /* EAN-13 from an ISBN, drawn as vector bars at 100% magnification. */
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const R = L.map(s => s.replace(/[01]/g, b => b === '0' ? '1' : '0')), Gc = R.map(s => s.split('').reverse().join(''));
  const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  BF.ean13Pattern = function (d) {
    let s = '101'; const par = PAR[+d[0]];
    for (let i = 0; i < 6; i++) s += (par[i] === 'L' ? L : Gc)[+d[i + 1]];
    s += '01010';
    for (let i = 0; i < 6; i++) s += R[+d[i + 7]];
    return s + '101';
  };
  function barcodeOps(ops, isbn, label, bx, by, bw, bh) {
    const mod = 0.33 * BF.MM, pat = BF.ean13Pattern(isbn), sw = 95 * mod, left = bx + (bw - sw) / 2 + 3 * mod, top = by + 15, barH = 17 * BF.MM;
    const mono = 'mono-r', hz = 6.4, hw = F(fk('heros', false, false)).width(label, hz);
    ops.push({ t: 't', x: bx + (bw - hw) / 2, y: by + 10.5, s: label, f: fk('heros', false, false), z: hz, c: [0, 0, 0] });
    for (let i = 0; i < 95;) {
      if (pat[i] === '1') {
        let j = i; while (j < 95 && pat[j] === '1') j++;
        const guard = i < 3 || (i >= 45 && i < 50) || i >= 92;
        ops.push({ t: 'r', x: left + i * mod, y: top, w: (j - i) * mod, h: barH + (guard ? 4.6 : 0), c: [0, 0, 0] });
        i = j;
      } else i++;
    }
    const dz = 8.2, dw = F(mono).width('0', dz), dy = top + barH + 8;
    ops.push({ t: 't', x: left - dw - 3.5, y: dy, s: isbn[0], f: mono, z: dz, c: [0, 0, 0] });
    for (let k = 0; k < 6; k++) {
      ops.push({ t: 't', x: left + (3 + 7 * k + 3.5) * mod - dw / 2, y: dy, s: isbn[k + 1], f: mono, z: dz, c: [0, 0, 0] });
      ops.push({ t: 't', x: left + (50 + 7 * k + 3.5) * mod - dw / 2, y: dy, s: isbn[k + 7], f: mono, z: dz, c: [0, 0, 0] });
    }
  }

  BF.layoutCover = function (book, storeId, pageCount) {
    const S = BF.STORES[storeId], setup = book.setup, meta = book.meta, c = book.cover || {}, t = BF.trim(setup.trim);
    const sp = BF.spineInches(storeId, pageCount, setup), bl = S.coverBleed * IN, tw = t.w * IN, th = t.h * IN, sw = sp.w * IN;
    const W = 2 * bl + 2 * tw + sw, H = th + 2 * bl, ops = [], notes = [];
    const backX = bl, spineX = bl + tw, frontX = bl + tw + sw;
    const bg = BF.hex(c.bg), fg = BF.hex(c.fg), ac = BF.hex(c.accent), tf = c.titleFont || 'poppins';
    ops.push({ t: 'r', x: 0, y: 0, w: W, h: H, c: bg });
    frontPanel(ops, book, { x: frontX, y: bl, w: tw, h: th }, { l: 0, r: bl, t: bl, b: bl });
    /* spine: background repeats so a drifting fold never shows a seam */
    ops.push({ t: 'r', x: spineX, y: 0, w: sw, h: H, c: c.spineAccent ? ac : bg });
    let spineText = false; const spCol = c.spineAccent ? bg : fg;
    if (c.spineText !== false) {
      if (pageCount < S.spineTextMin) notes.push({ k: 'spine-min', min: S.spineTextMin });
      else {
        const safe = (sw < 0.35 * IN && storeId !== 'kdp' ? Math.min(S.spineSafe, 0.03125) : S.spineSafe) * IN, avail = sw - 2 * safe;
        const f = fk(tf, true, false), fr = fk(tf, false, false), Fo = F(f);
        let zz = Math.min(13, avail / (Fo.capHeight / Fo.upm) * 0.92);
        const ti = BF.smart(meta.title || ''), au = BF.smart(meta.author || '').toUpperCase(), span = th * 0.86;
        while (zz > 5 && Fo.width(ti, zz) + (au ? F(fr).width(au, zz * 0.78, zz * 0.08) + 24 : 0) > span) zz -= 0.25;
        if (zz < 5.5) notes.push({ k: 'spine-thin' });
        else {
          const cap = Fo.capHeight / Fo.upm * zz, bxp = spineX + sw / 2 - cap / 2;
          ops.push({ t: 't', x: bxp, y: bl + th * 0.07, s: ti, f, z: zz, c: spCol, rot: 90 });
          if (au) { const aw = F(fr).width(au, zz * 0.78, zz * 0.08), cap2 = F(fr).capHeight / F(fr).upm * zz * 0.78; ops.push({ t: 't', x: spineX + sw / 2 - cap2 / 2, y: bl + th * 0.93 - aw, s: au, f: fr, z: zz * 0.78, c: spCol, rot: 90, ls: zz * 0.08 }); }
          spineText = true;
        }
      }
    }
    /* back */
    const backImg = c.backImage && book.images && book.images[c.backImage];
    if (backImg) ops.push({ t: 'i', x: 0, y: 0, w: bl + tw, h: H, img: c.backImage, fit: 'cover' });
    const bc = { w: 2 * IN, h: 1.2 * IN }; bc.x = spineX - 0.25 * IN - bc.w; bc.y = bl + th - 0.25 * IN - bc.h;
    const isbn = BF.isbn13(meta.isbnPrint), showBox = c.barcode !== false && (isbn || S.barcode !== 'optional');
    const mx = tw * 0.11, bw = tw - 2 * mx, x = backX + mx, bf = BF.FONT_FAMILIES[c.backFont] ? c.backFont : 'heros';
    let y = bl + th * 0.1; const limit = (showBox ? bc.y : bl + th - 0.5 * IN) - 14;
    if (!backImg || c.backTextOnImage) {
      if (c.backHeadline) { const f = fk(tf, true, false), ft = fit(BF.smart(c.backHeadline), f, bw, th * 0.16, tw * 0.05, 10, 1.18); y = textBlock(ops, ft.lines, f, ft.z, x, y, bw, 'left', ac, 1.18) + 10; }
      const bz = Math.max(8.5, Math.min(10.5, tw * 0.0235)), bLead = bz * 1.45; let cut = false;
      for (const para of String(c.blurb || '').split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean)) {
        for (const ln of BF.wrapPlain(BF.smart(para), fk(bf, false, false), bz, bw)) {
          if (y + bLead > limit) { cut = true; break; }
          ops.push({ t: 't', x, y: y + bz * 0.8, s: ln, f: fk(bf, false, false), z: bz, c: fg }); y += bLead;
        }
        if (cut) break; y += bLead * 0.55;
      }
      if (c.bio && !cut) {
        y += 4;
        for (const ln of BF.wrapPlain(BF.smart(c.bio), fk(bf, false, true), bz - 0.8, bw)) {
          if (y + bLead > limit) { cut = true; break; }
          ops.push({ t: 't', x, y: y + bz * 0.8, s: ln, f: fk(bf, false, true), z: bz - 0.8, c: fg }); y += bLead - 1;
        }
      }
      if (cut) notes.push({ k: 'back-overflow' });
      if (meta.publisher) ops.push({ t: 't', x, y: bl + th - 0.42 * IN, s: BF.smart(meta.publisher).toUpperCase(), f: fk(tf, true, false), z: 7.5, c: fg, ls: 1.2 });
    }
    if (showBox) {
      ops.push({ t: 'r', x: bc.x, y: bc.y, w: bc.w, h: bc.h, c: [1, 1, 1] });
      if (isbn) barcodeOps(ops, isbn, 'ISBN ' + String(meta.isbnPrint).trim(), bc.x, bc.y, bc.w, bc.h);
    }
    return { W, H, ops, notes, spine: sp, spineText, isbn, showBox, storeId,
      geom: { bl, tw, th, sw, backX, spineX, frontX, safe: S.coverSafe * IN, spineSafe: S.spineSafe * IN, barcode: showBox ? bc : null } };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
