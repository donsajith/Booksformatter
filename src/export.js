/* File writers: interior PDF, cover PDF, EPUB 3, DOCX. */
(function (G) {
  'use strict';
  const BF = G.BF, IN = 72, esc = BF.esc;
  const hasCanvas = typeof document !== 'undefined' && !!document.createElement;

  /* ---------- image preparation ---------- */
  function canvasFrom(asset, maxPx) {
    const sc = Math.min(1, maxPx / Math.max(asset.w, asset.h)), cw = Math.max(1, Math.round(asset.w * sc)), ch = Math.max(1, Math.round(asset.h * sc));
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(asset.el, 0, 0, cw, ch); return cv;
  }
  const toJpeg = (cv, q) => new Promise((res, rej) => cv.toBlob(b => b ? b.arrayBuffer().then(a => res(new Uint8Array(a))) : rej(new Error('Could not encode image')), 'image/jpeg', q));
  /* need: {id: widest placed size in points}. gray: true for black-ink interiors. */
  BF.prepImages = async function (book, need, gray) {
    const out = {};
    for (const id of Object.keys(need)) {
      const a = book.images[id]; if (!a) continue;
      const target = Math.ceil(need[id] / IN * 300 * 1.15), long = Math.max(a.w, a.h), down = long > target * 1.3;
      const info = a.type === 'image/jpeg' ? BF.jpegInfo(a.bytes) : null;
      if (!hasCanvas || !a.el) {
        if (info) out[id] = { kind: 'jpeg', bytes: a.bytes, pw: info.w, ph: info.h, comps: info.comps, variant: '' };
        continue;
      }
      if (gray) {
        if (info && info.comps === 1 && !down) { out[id] = { kind: 'jpeg', bytes: a.bytes, pw: info.w, ph: info.h, comps: 1, variant: ':g' }; continue; }
        const cv = canvasFrom(a, down ? target : long), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, g = new Uint8Array(cv.width * cv.height);
        for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 + 0.5) | 0;
        out[id] = { kind: 'gray', bytes: g, pw: cv.width, ph: cv.height, variant: ':g' };
      } else if (info && (info.comps === 3 || info.comps === 1) && !down) {
        out[id] = { kind: 'jpeg', bytes: a.bytes, pw: info.w, ph: info.h, comps: info.comps, variant: '' };
      } else {
        const cv = canvasFrom(a, down ? target : long);
        out[id] = { kind: 'jpeg', bytes: await toJpeg(cv, 0.93), pw: cv.width, ph: cv.height, comps: 3, variant: '' };
      }
    }
    return out;
  };
  BF.imageNeeds = function (ops, into) {
    for (const o of ops) if (o.t === 'i') into[o.img] = Math.max(into[o.img] || 0, o.w, o.h);
    return into;
  };

  /* ---------- PDFs ---------- */
  BF.interiorBleed = function (book, storeId) {
    const S = BF.STORES[storeId];
    return (book.setup.fullBleed || S.bleedAlways) ? S.ib : { out: 0, top: 0, bottom: 0, inn: 0 };
  };
  BF.buildInteriorPDF = async function (book, lay, storeId) {
    const ib = BF.interiorBleed(book, storeId), W = lay.geo.W, H = lay.geo.H, gray = !BF.paper(book.setup.paper).color;
    const need = {}; for (const p of lay.pages) BF.imageNeeds(p.ops, need);
    const imgs = await BF.prepImages(book, need, gray);
    const pdf = new BF.PDF();
    for (const p of lay.pages) {
      const Lb = (p.side === 'l' ? ib.out : ib.inn) * IN, Rb = (p.side === 'l' ? ib.inn : ib.out) * IN, T = ib.top * IN, B = ib.bottom * IN;
      const mw = W + Lb + Rb, mh = H + T + B;
      const ops = p.ops.map(o => o.bleed ? Object.assign({}, o, { x: o.x - Lb, y: o.y - T, w: o.w + Lb + Rb, h: o.h + T + B }) : o);
      pdf.addPage(mw, mh, [Lb, B, Lb + W, B + H], pdf.content(ops, mh, Lb, T, imgs));
    }
    return pdf.build({ title: book.meta.title, author: book.meta.author });
  };
  BF.buildCoverPDF = async function (book, cov) {
    const imgs = await BF.prepImages(book, BF.imageNeeds(cov.ops, {}), false);
    const pdf = new BF.PDF(), bl = cov.geom.bl;
    pdf.addPage(cov.W, cov.H, [bl, bl, cov.W - bl, cov.H - bl], pdf.content(cov.ops, cov.H, 0, 0, imgs));
    return pdf.build({ title: (book.meta.title || '') + ' (cover)', author: book.meta.author });
  };

  /* ---------- EPUB 3 ---------- */
  const runsHtml = runs => runs.map(r => { let s = esc(r.t); if (r.code) s = '<code>' + s + '</code>'; if (r.i) s = '<em>' + s + '</em>'; if (r.b) s = '<strong>' + s + '</strong>'; return s; }).join('');
  const EPUB_CSS = 'body{font-family:serif;line-height:1.5;margin:0 5%;}\nh1{font-size:1.7em;line-height:1.2;margin:1.2em 0 .4em;text-align:left;}\nh2{font-size:1.25em;margin:1.6em 0 .5em;}\nh3{font-size:1.05em;font-style:italic;margin:1.3em 0 .4em;}\np{margin:0;text-indent:1.4em;}\np.first,p.block{text-indent:0;}\np.block{margin:0 0 .8em;}\n.ch-label{text-indent:0;text-transform:uppercase;letter-spacing:.12em;font-size:.8em;margin-top:2.5em;}\n.subtitle{text-indent:0;font-style:italic;margin-bottom:1.5em;}\n.scene{text-indent:0;text-align:center;margin:1.2em 0;}\nblockquote{margin:1em 1.6em;}\nblockquote p{text-indent:0;margin-bottom:.5em;}\nfigure{margin:1.2em 0;text-align:center;page-break-inside:avoid;break-inside:avoid;}\nfigure img{max-width:100%;height:auto;}\nfigcaption{font-size:.85em;font-style:italic;margin-top:.4em;}\n.prompt{margin:1.2em 0;padding:.7em .9em;border-left:.25em solid #555;background:#eee;color:#111;}\n.prompt.outline{background:transparent;border:1px solid #555;}\n.prompt.dark{background:#222;color:#f4f4f4;border-left-color:#999;}\n.prompt-label{text-indent:0;font-family:sans-serif;font-size:.7em;font-weight:bold;letter-spacing:.1em;text-transform:uppercase;margin:0 0 .5em;}\n.prompt-label span{float:right;font-weight:normal;letter-spacing:0;text-transform:none;}\n.prompt pre{font-family:monospace;font-size:.85em;white-space:pre-wrap;word-wrap:break-word;margin:0;}\n.center{text-indent:0;text-align:center;}\n.title-page{text-align:center;margin-top:20%;}\n.title-page h1{text-align:center;font-size:2em;}\n.copyright p{text-indent:0;font-size:.85em;margin-bottom:.6em;}\n.dedication{margin-top:25%;text-align:center;font-style:italic;}\nnav ol{list-style:none;padding-left:0;}\nnav ol ol{padding-left:1.4em;}\nnav li{margin:.4em 0;}\ncode{font-family:monospace;font-size:.9em;}\n.pagebreak{page-break-before:always;break-before:page;}\n';
  BF.prepEbookImages = async function (book) {
    const out = {};
    for (const id of Object.keys(book.images || {})) {
      const a = book.images[id], long = Math.max(a.w, a.h);
      if (hasCanvas && a.el && (long > 2000 || !/^image\/(jpeg|png)$/.test(a.type))) out[id] = { bytes: await toJpeg(canvasFrom(a, Math.min(long, 1800)), 0.86), type: 'image/jpeg', ext: 'jpg' };
      else out[id] = { bytes: a.bytes, type: a.type === 'image/png' ? 'image/png' : 'image/jpeg', ext: a.type === 'image/png' ? 'png' : 'jpg' };
    }
    return out;
  };
  BF.buildEPUB = async function (book, coverJpeg) {
    const meta = book.meta, front = book.front || {}, lang = meta.lang || 'en', doSmart = book.setup.smart !== false, st = BF.resolveStyle(book.setup);
    const imgs = await BF.prepEbookImages(book), nums = BF.chapterNumbers(book), used = new Set(), files = [], manifest = [], spine = [], navItems = [];
    const page = (title, body, type) => '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="' + esc(lang) + '" xml:lang="' + esc(lang) + '">\n<head><meta charset="utf-8"/><title>' + esc(title) + '</title><link rel="stylesheet" type="text/css" href="style.css"/></head>\n<body' + (type ? ' epub:type="' + type + '"' : '') + '>\n' + body + '\n</body>\n</html>\n';
    const add = (id, name, title, body, type, nav) => { files.push({ name: 'OEBPS/' + name, data: page(title, body, type) }); manifest.push('<item id="' + id + '" href="' + name + '" media-type="application/xhtml+xml"/>'); spine.push('<itemref idref="' + id + '"/>'); if (nav) navItems.push(nav); };
    const fig = (id, cap) => { if (!imgs[id]) return ''; used.add(id); return '<figure><img src="images/' + id + '.' + imgs[id].ext + '" alt="' + esc(cap || '') + '"/>' + (cap ? '<figcaption>' + runsHtml(BF.parseInline(cap, doSmart)) + '</figcaption>' : '') + '</figure>'; };
    const T = s => esc(doSmart ? BF.smart(s) : s);
    if (front.titlePage !== false) add('titlepage', 'title.xhtml', meta.title || 'Title', '<section class="title-page" epub:type="titlepage"><h1>' + T(meta.title || 'Untitled') + '</h1>' + (meta.subtitle ? '<p class="subtitle center">' + T(meta.subtitle) + '</p>' : '') + (meta.author ? '<p class="center">' + T(meta.author) + '</p>' : '') + '</section>', 'frontmatter');
    if (front.copyright !== false) {
      let txt = (meta.copyrightText && meta.copyrightText.trim()) ? meta.copyrightText : BF.defaultCopyright(meta);
      if (meta.isbnEbook) txt = txt.split('\n').filter(l => !/\(paperback\)/.test(l)).join('\n');
      add('copyright', 'copyright.xhtml', 'Copyright', '<section class="copyright" epub:type="copyright-page">' + txt.split('\n').filter(l => l.trim()).map(l => '<p>' + esc(l) + '</p>').join('\n') + '</section>', 'frontmatter');
    }
    if (front.dedication && front.dedication.trim()) add('dedication', 'dedication.xhtml', 'Dedication', '<section class="dedication" epub:type="dedication">' + front.dedication.split('\n').filter(l => l.trim()).map(l => '<p class="center">' + T(l) + '</p>').join('') + '</section>', 'frontmatter');
    if (front.epigraph && front.epigraph.trim()) add('epigraph', 'epigraph.xhtml', 'Epigraph', '<section class="dedication" epub:type="epigraph">' + front.epigraph.split('\n').filter(l => l.trim()).map(l => '<p class="center">' + T(l) + '</p>').join('') + (front.epigraphSource ? '<p class="center">— ' + T(front.epigraphSource) + '</p>' : '') + '</section>', 'frontmatter');
    let n = 0;
    for (const sec of BF.orderedSections(book)) {
      n++; const fid = 's' + String(n).padStart(3, '0'), name = fid + '.xhtml', num = sec.kind === 'chapter' ? nums.get(sec.id) : null, subs = [];
      let h = '<section epub:type="' + (sec.kind === 'chapter' ? 'chapter' : sec.kind === 'front' ? 'preface' : 'appendix') + '" id="' + fid + '">\n';
      const ci = sec.image && sec.image.id && imgs[sec.image.id] ? sec.image : null;
      if (ci && ci.place !== 'below') h += fig(ci.id, ci.caption) + '\n';
      if (num) h += '<p class="ch-label">Chapter ' + num + '</p>\n';
      h += '<h1>' + T(sec.title || 'Untitled') + '</h1>\n';
      if (sec.subtitle) h += '<p class="subtitle">' + T(sec.subtitle) + '</p>\n';
      if (ci && ci.place === 'below') h += fig(ci.id, ci.caption) + '\n';
      let first = true, hn = 0; const pc = st.para === 'block' ? 'block' : null;
      for (const it of BF.walkSection(sec, doSmart)) {
        if (it.k === 'p') { h += '<p' + (pc ? ' class="block"' : first ? ' class="first"' : '') + '>' + runsHtml(it.runs) + '</p>\n'; first = false; }
        else if (it.k === 'h') { if (it.level === 2) { const hid = fid + '-h' + (++hn); h += '<h2 id="' + hid + '">' + esc(it.text) + '</h2>\n'; subs.push({ href: name + '#' + hid, title: it.text }); } else h += '<h3>' + esc(it.text) + '</h3>\n'; first = true; }
        else if (it.k === 'ul' || it.k === 'ol') h += '<' + it.k + (it.k === 'ol' && it.start > 1 ? ' start="' + it.start + '"' : '') + '>' + it.items.map(r => '<li>' + runsHtml(r) + '</li>').join('') + '</' + it.k + '>\n';
        else if (it.k === 'quote') { h += '<blockquote>' + it.paras.map(r => '<p>' + runsHtml(r) + '</p>').join('') + '</blockquote>\n'; first = true; }
        else if (it.k === 'scene') { h += '<p class="scene">* * *</p>\n'; first = true; }
        else if (it.k === 'image') h += fig(it.img, it.caption) + '\n';
        else if (it.k === 'prompt') { const look = it.look || book.setup.promptLook || 'shaded'; h += '<div class="prompt ' + look + '"><p class="prompt-label">' + esc(it.label || 'Prompt') + (it.tool ? ' <span>' + esc(it.tool) + '</span>' : '') + '</p><pre>' + esc(it.text) + '</pre></div>\n'; }
      }
      h += '</section>';
      add(fid, name, sec.title || 'Untitled', h, sec.kind === 'chapter' ? 'bodymatter' : sec.kind === 'front' ? 'frontmatter' : 'backmatter', { href: name, title: (num ? num + '. ' : '') + (sec.title || 'Untitled'), subs });
    }
    const navLi = it => '<li><a href="' + it.href + '">' + T(it.title) + '</a>' + (front.tocSections && it.subs && it.subs.length ? '<ol>' + it.subs.map(s => '<li><a href="' + s.href + '">' + esc(s.title) + '</a></li>').join('') + '</ol>' : '') + '</li>';
    files.push({ name: 'OEBPS/nav.xhtml', data: page(front.tocTitle || 'Contents', '<nav epub:type="toc" id="toc"><h1>' + esc(front.tocTitle || 'Contents') + '</h1><ol>' + navItems.map(navLi).join('\n') + '</ol></nav>') });
    manifest.unshift('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
    const isbn = BF.isbn13(meta.isbnEbook), uid = isbn ? 'urn:isbn:' + isbn : 'urn:uuid:' + (book.uuid || (book.uuid = 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16))));
    let ncx = '<?xml version="1.0" encoding="utf-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="' + esc(uid) + '"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head><docTitle><text>' + esc(meta.title || 'Untitled') + '</text></docTitle><navMap>';
    navItems.forEach((it, i) => { ncx += '<navPoint id="np' + (i + 1) + '" playOrder="' + (i + 1) + '"><navLabel><text>' + T(it.title) + '</text></navLabel><content src="' + it.href + '"/></navPoint>'; });
    files.push({ name: 'OEBPS/toc.ncx', data: ncx + '</navMap></ncx>' });
    manifest.push('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>', '<item id="css" href="style.css" media-type="text/css"/>');
    files.push({ name: 'OEBPS/style.css', data: EPUB_CSS });
    for (const id of used) { files.push({ name: 'OEBPS/images/' + id + '.' + imgs[id].ext, data: imgs[id].bytes, store: true }); manifest.push('<item id="img-' + id + '" href="images/' + id + '.' + imgs[id].ext + '" media-type="' + imgs[id].type + '"/>'); }
    if (coverJpeg) { files.push({ name: 'OEBPS/images/cover.jpg', data: coverJpeg, store: true }); manifest.push('<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>'); }
    const mod = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const opf = '<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="' + esc(lang) + '">\n<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n<dc:identifier id="bookid">' + esc(uid) + '</dc:identifier>\n<dc:title>' + esc(meta.title || 'Untitled') + '</dc:title>\n<dc:language>' + esc(lang) + '</dc:language>\n' + (meta.author ? '<dc:creator>' + esc(meta.author) + '</dc:creator>\n' : '') + (meta.publisher ? '<dc:publisher>' + esc(meta.publisher) + '</dc:publisher>\n' : '') + (meta.description ? '<dc:description>' + esc(meta.description) + '</dc:description>\n' : '') + '<meta property="dcterms:modified">' + mod + '</meta>\n' + (coverJpeg ? '<meta name="cover" content="cover-image"/>\n' : '') + '</metadata>\n<manifest>\n' + manifest.join('\n') + '\n</manifest>\n<spine toc="ncx">\n' + spine.join('\n') + '\n</spine>\n</package>\n';
    files.push({ name: 'OEBPS/content.opf', data: opf });
    return BF.zip([{ name: 'mimetype', data: 'application/epub+zip', store: true }, { name: 'META-INF/container.xml', data: '<?xml version="1.0" encoding="utf-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' }, ...files]);
  };

  /* ---------- DOCX ---------- */
  BF.buildDOCX = async function (book, geo) {
    const meta = book.meta, front = book.front || {}, doSmart = book.setup.smart !== false, st = BF.resolveStyle(book.setup), nums = BF.chapterNumbers(book);
    const imgs = await BF.prepEbookImages(book), media = [], rels = []; let rid = 10, lists = 0;
    const bodyFont = BF.FONT_FAMILIES[st.body].word, headFont = BF.FONT_FAMILIES[st.head].word, T = s => doSmart ? BF.smart(s) : String(s || '');
    const tw = v => Math.round(v * 20), half = z => Math.round(z * 2);
    const run = (t, o) => { o = o || {}; const p = (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>' : ''); return '<w:r>' + (p ? '<w:rPr>' + p + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>'; };
    const runs = rs => rs.map(r => run(r.t, r)).join('');
    const para = (style, inner, extra) => '<w:p><w:pPr><w:pStyle w:val="' + style + '"/>' + (extra || '') + '</w:pPr>' + inner + '</w:p>';
    const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    const frameW = geo.W - geo.m.inside - geo.m.outside;
    const picture = id => {
      const a = book.images[id], im = imgs[id]; if (!a || !im) return '';
      const r = 'rId' + (++rid), name = 'image' + rid + '.' + im.ext; media.push({ name: 'word/media/' + name, data: im.bytes, store: true });
      rels.push('<Relationship Id="' + r + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + name + '"/>');
      let w = frameW, h = w * a.h / a.w; const maxH = (geo.H - geo.m.top - geo.m.bottom) * 0.7; if (h > maxH) { h = maxH; w = h * a.w / a.h; }
      const cx = Math.round(w * 12700), cy = Math.round(h * 12700);
      return '<w:p><w:pPr><w:pStyle w:val="Figure"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + rid + '" name="Picture ' + rid + '"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + rid + '" name="' + name + '"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + r + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
    };
    const figure = (id, cap) => picture(id) + (cap && imgs[id] ? para('Caption', runs(BF.parseInline(cap, doSmart))) : '');
    let b = '';
    if (front.titlePage !== false) {
      b += para('Title', run(T(meta.title || 'Untitled')));
      if (meta.subtitle) b += para('Subtitle', run(T(meta.subtitle)));
      if (meta.author) b += para('Author', run(T(meta.author)));
      b += pageBreak;
    }
    if (front.copyright !== false) { const txt = (meta.copyrightText && meta.copyrightText.trim()) ? meta.copyrightText : BF.defaultCopyright(meta); for (const l of txt.split('\n')) b += para('Small', l.trim() ? run(l) : ''); b += pageBreak; }
    if (front.dedication && front.dedication.trim()) { for (const l of front.dedication.split('\n')) b += para('Centered', run(T(l), { i: true })); b += pageBreak; }
    if (front.epigraph && front.epigraph.trim()) { for (const l of front.epigraph.split('\n')) b += para('Centered', run(T(l), { i: true })); if (front.epigraphSource) b += para('Centered', run('— ' + T(front.epigraphSource))); b += pageBreak; }
    if (front.toc !== false) {
      b += para('TOCHeading', run(front.tocTitle || 'Contents'));
      b += '<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-' + (front.tocSections ? 2 : 1) + '" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Right-click and choose Update Field to build the table of contents.</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>' + pageBreak;
    }
    const secs = BF.orderedSections(book);
    for (const sec of secs) {
      const num = sec.kind === 'chapter' ? nums.get(sec.id) : null, ci = sec.image && sec.image.id && imgs[sec.image.id] ? sec.image : null;
      if (ci && ci.place !== 'below') b += figure(ci.id, ci.caption);
      if (num) b += para('ChapterLabel', run('Chapter ' + num));
      b += para('Heading1', run(T(sec.title || 'Untitled')));
      if (sec.subtitle) b += para('Subtitle', run(T(sec.subtitle)));
      if (ci && ci.place === 'below') b += figure(ci.id, ci.caption);
      let first = true;
      for (const it of BF.walkSection(sec, doSmart)) {
        if (it.k === 'p') { b += para(first || st.para === 'block' ? 'First' : 'Body', runs(it.runs)); first = false; }
        else if (it.k === 'h') { b += para(it.level === 2 ? 'Heading2' : 'Heading3', run(it.text)); first = true; }
        else if (it.k === 'ul' || it.k === 'ol') { lists++; it.items.forEach(r => { b += para('ListItem', runs(r), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + (it.k === 'ul' ? 1 : 100 + lists) + '"/></w:numPr>'); }); it._num = 100 + lists; }
        else if (it.k === 'quote') { it.paras.forEach(r => { b += para('Quote', runs(r)); }); first = true; }
        else if (it.k === 'scene') { b += para('Centered', run('* * *')); first = true; }
        else if (it.k === 'image') b += figure(it.img, it.caption);
        else if (it.k === 'prompt') {
          b += para('PromptLabel', run(String(it.label || 'Prompt').toUpperCase() + (it.tool ? '   ·   ' + it.tool : '')));
          const lines = String(it.text || '').replace(/\r\n?/g, '\n').split('\n');
          b += para('Prompt', lines.map((l, i) => '<w:r>' + (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + esc(l) + '</w:t></w:r>').join(''));
        }
        else if (it.k === 'break') b += pageBreak;
      }
      if (sec !== secs[secs.length - 1]) b += pageBreak;
    }
    const m = geo.m, sect = '<w:sectPr><w:pgSz w:w="' + tw(geo.W) + '" w:h="' + tw(geo.H) + '"/><w:pgMar w:top="' + tw(m.top) + '" w:right="' + tw(m.outside) + '" w:bottom="' + tw(m.bottom) + '" w:left="' + tw(m.inside) + '" w:header="' + tw(m.top * 0.5) + '" w:footer="' + tw(m.bottom * 0.5) + '" w:gutter="0"/></w:sectPr>';
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
    const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ' + NS + '><w:body>' + b + sect + '</w:body></w:document>';
    const z = st.size, ld = Math.round(st.leadPt * 20);
    const sty = (id, name, based, ppr, rpr, next) => '<w:style w:type="paragraph"' + (id === 'Normal' ? ' w:default="1"' : '') + ' w:styleId="' + id + '"><w:name w:val="' + name + '"/>' + (based ? '<w:basedOn w:val="' + based + '"/>' : '') + (next ? '<w:next w:val="' + next + '"/>' : '') + '<w:qFormat/><w:pPr>' + (ppr || '') + '</w:pPr><w:rPr>' + (rpr || '') + '</w:rPr></w:style>';
    const hf = '<w:rFonts w:ascii="' + headFont + '" w:hAnsi="' + headFont + '" w:cs="' + headFont + '"/>', mf = '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>';
    const jc = st.justify ? '<w:jc w:val="both"/>' : '';
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="' + bodyFont + '" w:hAnsi="' + bodyFont + '" w:cs="' + bodyFont + '"/><w:sz w:val="' + half(z) + '"/><w:szCs w:val="' + half(z) + '"/><w:lang w:val="' + esc(meta.lang || 'en') + '"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="' + ld + '" w:lineRule="exact"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      sty('Normal', 'Normal', null, '', '') +
      sty('Body', 'Body Text', 'Normal', jc + (st.para === 'indent' ? '<w:ind w:firstLine="' + tw(z * 1.5) + '"/>' : '<w:spacing w:after="' + tw(st.leadPt * 0.55) + '" w:line="' + ld + '" w:lineRule="exact"/>'), '') +
      sty('First', 'First Paragraph', 'Normal', jc + (st.para === 'block' ? '<w:spacing w:after="' + tw(st.leadPt * 0.55) + '" w:line="' + ld + '" w:lineRule="exact"/>' : ''), '', 'Body') +
      sty('Title', 'Title', 'Normal', '<w:spacing w:before="2400" w:after="240" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>', hf + '<w:b/><w:sz w:val="56"/>') +
      sty('Subtitle', 'Subtitle', 'Normal', '<w:spacing w:after="360" w:line="240" w:lineRule="auto"/><w:jc w:val="' + (st.ch.align === 'center' ? 'center' : 'left') + '"/>', '<w:i/><w:sz w:val="' + half(z + 3) + '"/>') +
      sty('Author', 'Author', 'Normal', '<w:spacing w:before="480" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>', hf + '<w:sz w:val="30"/>') +
      sty('ChapterLabel', 'Chapter Label', 'Normal', '<w:spacing w:before="1200" w:after="120" w:line="240" w:lineRule="auto"/><w:jc w:val="' + (st.ch.align === 'center' ? 'center' : 'left') + '"/>', hf + '<w:caps/><w:spacing w:val="30"/><w:sz w:val="18"/>') +
      sty('Heading1', 'heading 1', 'Normal', '<w:keepNext/><w:spacing w:before="240" w:after="480" w:line="240" w:lineRule="auto"/><w:jc w:val="' + (st.ch.align === 'center' ? 'center' : 'left') + '"/><w:outlineLvl w:val="0"/>', hf + (st.ch.titleB ? '<w:b/>' : '') + '<w:sz w:val="' + half(st.ch.titleZ) + '"/>', 'First') +
      sty('Heading2', 'heading 2', 'Normal', '<w:keepNext/><w:spacing w:before="360" w:after="120" w:line="240" w:lineRule="auto"/><w:outlineLvl w:val="1"/>', (st.h2.fam === 'head' ? hf : '') + (st.h2.b ? '<w:b/>' : '') + (st.h2.i ? '<w:i/>' : '') + '<w:sz w:val="' + half(st.h2.z) + '"/>', 'First') +
      sty('Heading3', 'heading 3', 'Normal', '<w:keepNext/><w:spacing w:before="240" w:after="60" w:line="240" w:lineRule="auto"/><w:outlineLvl w:val="2"/>', '<w:b/><w:i/>', 'First') +
      sty('TOCHeading', 'TOC Heading', 'Normal', '<w:spacing w:before="720" w:after="360" w:line="240" w:lineRule="auto"/>', hf + '<w:b/><w:sz w:val="40"/>') +
      sty('Quote', 'Quote', 'Normal', jc + '<w:spacing w:before="120" w:after="120" w:line="' + ld + '" w:lineRule="exact"/><w:ind w:left="' + tw(z * 1.8) + '" w:right="' + tw(z * 1.8) + '"/>', '') +
      sty('ListItem', 'List Paragraph', 'Normal', '<w:spacing w:after="60" w:line="' + ld + '" w:lineRule="exact"/>', '') +
      sty('Centered', 'Centered', 'Normal', '<w:spacing w:before="120" w:after="120"/><w:jc w:val="center"/>', '') +
      sty('Small', 'Small Print', 'Normal', '<w:spacing w:after="80" w:line="240" w:lineRule="auto"/>', '<w:sz w:val="17"/>') +
      sty('Figure', 'Figure', 'Normal', '<w:keepNext/><w:spacing w:before="200" w:after="80" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>', '') +
      sty('Caption', 'caption', 'Normal', '<w:spacing w:after="200" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>', '<w:i/><w:sz w:val="' + half(Math.max(7.5, z - 1.5)) + '"/>') +
      sty('PromptLabel', 'Prompt Label', 'Normal', '<w:keepNext/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="444444"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="ECECEC"/><w:spacing w:before="200" w:after="0" w:line="240" w:lineRule="auto"/>', hf + '<w:b/><w:spacing w:val="20"/><w:sz w:val="14"/><w:color w:val="555555"/>', 'Prompt') +
      sty('Prompt', 'Prompt', 'Normal', '<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="444444"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="ECECEC"/><w:spacing w:after="200" w:line="252" w:lineRule="auto"/>', mf + '<w:sz w:val="17"/>', 'Body') +
      '</w:styles>';
    let numbering = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + tw(z * 1.9) + '" w:hanging="' + tw(z * 1.1) + '"/></w:pPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + tw(z * 1.9) + '" w:hanging="' + tw(z * 1.4) + '"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>';
    for (let i = 1; i <= lists; i++) numbering += '<w:num w:numId="' + (100 + i) + '"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>';
    numbering += '</w:numbering>';
    const ctypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return BF.zip([
      { name: '[Content_Types].xml', data: ctypes },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
      { name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + esc(meta.title || '') + '</dc:title><dc:creator>' + esc(meta.author || '') + '</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>' },
      { name: 'word/document.xml', data: doc },
      { name: 'word/styles.xml', data: styles },
      { name: 'word/numbering.xml', data: numbering },
      { name: 'word/settings.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:mirrorMargins/><w:updateFields w:val="true"/></w:settings>' },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' + rels.join('') + '</Relationships>' },
      ...media
    ]);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
