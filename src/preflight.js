/* Preflight: list what a store's upload check would reject or question. */
(function (G) {
  'use strict';
  const BF = G.BF, IN = 72, f3 = v => (Math.round(v * 1000) / 1000).toFixed(3), f2 = v => (Math.round(v * 100) / 100).toString();
  BF.buildCovers = function (book, lay) { const o = {}; for (const id of BF.activeStores(book.setup)) o[id] = BF.layoutCover(book, id, lay.pageCount); return o; };
  BF.preflight = function (book, lay, covers) {
    const out = [], add = (level, scope, msg, tab) => out.push({ level, scope, msg, tab: tab || '' });
    const setup = book.setup, meta = book.meta, stores = BF.activeStores(setup), paper = BF.paper(setup.paper), t = BF.trim(setup.trim), N = lay.pageCount, m = lay.geo.mIn;
    const chapters = book.sections.filter(s => s.kind === 'chapter');
    if (!stores.length) add('error', 'book', 'No store is selected. Pick at least one under Setup.', 'setup');
    if (!meta.title || !meta.title.trim()) add('error', 'book', 'The book has no title. Every store needs one, and it must match the title on the cover.', 'matter');
    if (!meta.author || !meta.author.trim()) add('error', 'book', 'The book has no author name.', 'matter');
    if (!chapters.length) add('error', 'book', 'There are no chapters yet. Import a manuscript or add a chapter.', 'manuscript');
    if (lay.words < 50) add('warn', 'book', 'The manuscript has almost no text (' + lay.words + ' words).', 'manuscript');
    for (const s of book.sections) {
      if (!s.title || !s.title.trim()) add('warn', 'book', 'A ' + (s.kind === 'chapter' ? 'chapter' : 'section') + ' has no title. It will show as "Untitled" in the contents.', 'manuscript');
      else if (!(s.blocks || []).some(b => (b.md || b.text || b.img || '').toString().trim())) add('warn', 'book', '"' + s.title + '" is empty.', 'manuscript');
    }
    if (lay.missing && lay.missing.size) add('error', 'book', 'These characters are not in the chosen fonts and would print as empty boxes: ' + Array.from(lay.missing).slice(0, 30).map(c => String.fromCodePoint(c)).join(' ') + '. Replace them, or move the text into a prompt box (the prompt font covers more symbols).', 'manuscript');
    if (lay.notes.some(n => n.k === 'missing-image')) add('error', 'book', 'A picture block points at an image that is no longer in the project. Re-add the image.', 'manuscript');
    const seen = new Map();
    for (const p of lay.placed) {
      const a = book.images[p.id]; if (!a) continue;
      const dpi = Math.min(a.w / (p.w / IN), a.h / (p.h / IN)), prev = seen.get(p.id);
      if (!prev || dpi < prev.dpi) seen.set(p.id, { dpi, p, a });
    }
    for (const { dpi, p, a } of seen.values()) {
      const need = Math.ceil(p.w / IN * 300) + ' × ' + Math.ceil(p.h / IN * 300) + ' px', where = '"' + a.name + '" on page ' + lay.pages[p.page].label;
      if (dpi < 150) add('error', 'book', where + ' prints at ' + Math.round(dpi) + ' dpi (' + a.w + ' × ' + a.h + ' px). Print needs 300 dpi: use an image of at least ' + need + ', or set it smaller.', 'manuscript');
      else if (dpi < 295) add('warn', 'book', where + ' prints at ' + Math.round(dpi) + ' dpi. Stores ask for 300; at this size it needs ' + need + '.', 'manuscript');
    }
    if (seen.size && !paper.color) add('info', 'book', 'This is a black-ink interior, so the ' + seen.size + ' picture' + (seen.size > 1 ? 's are' : ' is') + ' written to the PDF in greyscale.', 'setup');
    if (meta.isbnPrint && !BF.isbn13(meta.isbnPrint)) add('error', 'book', 'The print ISBN "' + meta.isbnPrint + '" does not pass its check digit. No barcode is drawn until it is corrected.', 'matter');
    let run = 0, maxRun = 0; lay.pages.forEach((p, i) => { run = p.blank ? run + 1 : 0; if (i < lay.pages.length - 2) maxRun = Math.max(maxRun, run); });
    if (maxRun > 2) add('warn', 'book', 'There are ' + maxRun + ' blank pages in a row. KDP questions more than two.', 'matter');
    const headTop = Math.min(...lay.pages.filter(p => p.headTop != null).map(p => p.headTop / IN), 99), footBot = Math.min(...lay.pages.filter(p => p.footBottom != null).map(p => (lay.geo.H - p.footBottom) / IN), 99);
    for (const id of stores) {
      const S = BF.STORES[id], cov = covers[id], range = S.pages[setup.paper];
      if (S.trims.indexOf(t.id) < 0) add('warn', id, BF.trimLabel(t) + ' is not on the list of ' + S.short + ' trim sizes in this tool. Confirm it on the store before uploading, or pick another size.', 'setup');
      else if (S.custom && S.custom.indexOf(t.id) >= 0) add('info', id, BF.trimLabel(t) + ' is a custom size on ' + S.short + ': it prints, but may limit expanded distribution.', 'setup');
      if (S.bwOnly && paper.color) add('error', id, S.short + ' prints black-ink interiors only. Choose white or cream paper, or leave this store out.', 'setup');
      if (N < range[0]) add('error', id, 'The book has ' + N + ' pages. ' + S.short + ' needs at least ' + range[0] + ' for this paper.', 'manuscript');
      else if (N > range[1]) add('error', id, 'The book has ' + N + ' pages. ' + S.short + ' prints at most ' + range[1] + ' on this paper. Use a larger trim size or smaller type.', 'setup');
      else add('pass', id, N + ' pages, within ' + S.short + "'s " + range[0] + ' to ' + range[1] + '.');
      const g = S.gutter(N), om = setup.fullBleed ? S.outsideMinBleed : S.outsideMin;
      if (m.inside + 0.001 < g) add('error', id, 'Inside margin is ' + f2(m.inside) + ' in. ' + S.short + ' needs ' + f2(g) + ' in at ' + N + ' pages.', 'setup');
      else if (m.outside + 0.001 < om || m.top + 0.001 < om || m.bottom + 0.001 < om) add('error', id, 'An outer margin is under ' + S.short + "'s minimum of " + f2(om) + ' in.', 'setup');
      else if (headTop + 0.004 < S.safety || footBot + 0.004 < S.safety) add('warn', id, 'A running head or page number sits ' + f2(Math.min(headTop, footBot)) + ' in from the trim. ' + S.short + ' wants everything ' + f2(S.safety) + ' in clear.', 'setup');
      else add('pass', id, 'Margins clear: inside ' + f2(m.inside) + ' in (minimum ' + f2(g) + '), outside ' + f2(m.outside) + ' in.');
      const ib = BF.interiorBleed(book, id), pw = t.w + ib.out + ib.inn, ph = t.h + ib.top + ib.bottom;
      add('pass', id, 'Interior PDF pages are ' + f3(pw) + ' × ' + f3(ph) + ' in' + (ib.out ? ' (trim plus bleed)' : ' (exact trim, no bleed)') + ', fonts embedded' + (paper.color ? '' : ', greyscale only') + '.');
      if (cov) {
        const sp = cov.spine;
        if (sp.source === 'formula') add('pass', id, 'Spine ' + f3(sp.w) + ' in from ' + S.short + "'s published formula. Cover sheet " + f3(cov.W / IN) + ' × ' + f3(cov.H / IN) + ' in.');
        else if (sp.source === 'override') add('pass', id, 'Spine ' + f3(sp.w) + ' in, the figure you entered. Cover sheet ' + f3(cov.W / IN) + ' × ' + f3(cov.H / IN) + ' in.');
        else add('warn', id, 'Spine ' + f3(sp.w) + ' in is an estimate: ' + S.short + ' publishes no formula. Get the exact width from its cover template for ' + N + ' pages and enter it under Cover, or the upload may be rejected.', 'cover');
        for (const n of cov.notes) {
          if (n.k === 'spine-min') add('info', id, 'Spine left blank: ' + S.short + ' prints spine text from ' + n.min + ' pages and this book has ' + N + '.', 'cover');
          if (n.k === 'spine-thin') add('info', id, 'Spine left blank: at ' + f3(sp.w) + ' in it is too narrow for readable text.', 'cover');
          if (n.k === 'back-overflow') add('warn', id, 'The back-cover text runs into the barcode area and was cut short. Shorten the blurb.', 'cover');
        }
        if (cov.isbn) add('pass', id, 'Barcode drawn from ISBN ' + cov.isbn + ', 0.25 in from the spine fold and the bottom trim.');
        else if (S.isbn === 'required') add('error', id, S.short + ' needs your own ISBN and a barcode on the cover. Enter the print ISBN under Front & back.', 'matter');
        else if (cov.showBox) add('info', id, 'No ISBN entered, so a clear 2 × 1.2 in box is left for ' + S.short + ' to print its own barcode.', 'matter');
        const c = book.cover || {}, fi = c.frontImage && book.images[c.frontImage];
        if (fi) { const dpi = fi.w / t.w * (c.frontImageMode === 'full' ? 1 : 1); if (dpi < 200) add('error', id, 'The front-cover picture is ' + fi.w + ' px wide, about ' + Math.round(dpi) + ' dpi across the cover. Use one at least ' + Math.ceil((t.w + 0.125) * 300) + ' px wide.', 'cover'); else if (dpi < 295) add('warn', id, 'The front-cover picture prints at about ' + Math.round(dpi) + ' dpi; 300 is the target.', 'cover'); }
        if (S.cmyk) add('warn', id, S.short + ' asks for CMYK PDF/X-1a. The cover here is RGB with embedded fonts: ' + S.short + ' converts it on upload and strong colours can shift. For a colour-critical cover, convert the PDF to PDF/X-1a in Acrobat or Affinity first.', 'cover');
      }
      if (S.lastBlank && !lay.pages[N - 1].blank) add('info', id, S.short + ' uses the last page for its own print code and adds a blank one if yours is not blank. Expect the printed page count to grow by two.', 'matter');
    }
    add(meta.isbnEbook && !BF.isbn13(meta.isbnEbook) ? 'error' : 'pass', 'ebook', meta.isbnEbook ? (BF.isbn13(meta.isbnEbook) ? 'EPUB carries ebook ISBN ' + BF.isbn13(meta.isbnEbook) + '.' : 'The ebook ISBN does not pass its check digit.') : 'EPUB uses a generated identifier. An ebook ISBN is optional on KDP, Kobo, Apple and Draft2Digital.', 'matter');
    add('pass', 'ebook', 'EPUB 3 with navigation, a contents page for older readers and a cover image marked as the cover.');
    if (!meta.description) add('info', 'ebook', 'No description is set. Stores ask for it at upload; adding it here also puts it in the EPUB.', 'matter');
    if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(meta.lang || '')) add('warn', 'ebook', 'The language code "' + (meta.lang || '') + '" is not a valid tag such as en or en-GB.', 'matter');
    return out;
  };
  BF.preflightText = function (book, lay, items) {
    const L = ['Preflight report: ' + (book.meta.title || 'Untitled'), 'Trim ' + BF.trimLabel(BF.trim(book.setup.trim)) + ', ' + lay.pageCount + ' pages, ' + BF.paper(book.setup.paper).label, 'Store rules as published, ' + BF.SPEC_DATE + '. Stores change them: confirm against each store before you order copies.', ''];
    const groups = ['book'].concat(BF.activeStores(book.setup), ['ebook']);
    for (const g of groups) { const its = items.filter(i => i.scope === g); if (!its.length) continue; L.push(g === 'book' ? 'THE BOOK' : g === 'ebook' ? 'EBOOK' : BF.STORES[g].name.toUpperCase()); for (const i of its) L.push('  [' + ({ error: 'FIX', warn: 'CHECK', info: 'NOTE', pass: 'OK' })[i.level] + '] ' + i.msg); L.push(''); }
    return L.join('\n');
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
