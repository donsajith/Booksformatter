/* Store rules, trim sizes, paper, interior styles, margin and spine maths. */
(function (G) {
  'use strict';
  const BF = G.BF = G.BF || {};
  BF.IN = 72; BF.MM = 72 / 25.4;
  BF.SPEC_DATE = 'November 2026';

  BF.TRIMS = [
    { id: '5x8', w: 5, h: 8, note: 'Fiction, novellas' },
    { id: '5.06x7.81', w: 5.06, h: 7.81, note: 'UK B-format' },
    { id: '5.25x8', w: 5.25, h: 8, note: 'Fiction, memoir' },
    { id: '5.25x8.5', w: 5.25, h: 8.5, note: 'Draft2Digital digest' },
    { id: '5.5x8.5', w: 5.5, h: 8.5, note: 'Digest: fiction and non-fiction' },
    { id: '5.83x8.27', w: 5.83, h: 8.27, note: 'A5' },
    { id: '6x9', w: 6, h: 9, note: 'US trade: most non-fiction' },
    { id: '6.14x9.21', w: 6.14, h: 9.21, note: 'Royal' },
    { id: '6.69x9.61', w: 6.69, h: 9.61, note: 'Pinched crown' },
    { id: '7x10', w: 7, h: 10, note: 'Technical, textbooks' },
    { id: '7.44x9.69', w: 7.44, h: 9.69, note: 'Crown quarto' },
    { id: '7.5x9.25', w: 7.5, h: 9.25, note: 'Manuals, guides' },
    { id: '8x10', w: 8, h: 10, note: 'Workbooks' },
    { id: '8.25x8.25', w: 8.25, h: 8.25, note: 'Square' },
    { id: '8.5x8.5', w: 8.5, h: 8.5, note: 'Square' },
    { id: '8.25x11', w: 8.25, h: 11, note: 'Large format' },
    { id: '8.27x11.69', w: 8.27, h: 11.69, note: 'A4' },
    { id: '8.5x11', w: 8.5, h: 11, note: 'US Letter: workbooks' }
  ];
  BF.trim = id => BF.TRIMS.find(t => t.id === id) || BF.TRIMS[5];
  BF.trimLabel = t => t.w + ' × ' + t.h + ' in';

  BF.PAPERS = [
    { id: 'white', label: 'White paper, black ink', color: false },
    { id: 'cream', label: 'Cream paper, black ink', color: false },
    { id: 'color-std', label: 'White paper, standard colour', color: true },
    { id: 'color-prem', label: 'White paper, premium colour', color: true }
  ];
  BF.paper = id => BF.PAPERS.find(p => p.id === id) || BF.PAPERS[0];

  const kdpGutter = p => p <= 150 ? 0.375 : p <= 300 ? 0.5 : p <= 500 ? 0.625 : p <= 700 ? 0.75 : 0.875;
  const ALL = BF.TRIMS.map(t => t.id);
  /* spine(): inches. exact:true means the store publishes the formula; otherwise the figure
     is an estimate and the store's own template is the authority. */
  BF.STORES = {
    kdp: {
      name: 'Amazon KDP', short: 'KDP', exact: true,
      spine: (p, paper) => p * ({ white: 0.002252, cream: 0.0025, 'color-std': 0.002252, 'color-prem': 0.002347 })[paper],
      pages: { white: [24, 828], cream: [24, 776], 'color-std': [72, 600], 'color-prem': [24, 828] },
      spineTextMin: 80, spineSafe: 0.0625, gutter: kdpGutter, outsideMin: 0.25, outsideMinBleed: 0.375, safety: 0.25,
      coverBleed: 0.125, coverSafe: 0.125, ib: { out: 0.125, top: 0.125, bottom: 0.125, inn: 0 }, bleedAlways: false,
      barcode: 'auto', isbn: 'optional', trims: ALL, custom: ['5.25x8.5', '5.83x8.27', '8.25x11'],
      template: 'https://kdp.amazon.com/cover-calculator',
      notes: ['KDP adds the barcode itself if the 2 × 1.2 in box is left clear.']
    },
    ingram: {
      name: 'IngramSpark', short: 'IngramSpark', exact: false,
      spine: (p, paper) => p / ({ white: 512, cream: 444, 'color-std': 512, 'color-prem': 377 })[paper],
      pages: { white: [18, 1200], cream: [18, 1200], 'color-std': [18, 1200], 'color-prem': [18, 900] },
      spineTextMin: 48, spineSafe: 0.0625, gutter: () => 0.5, outsideMin: 0.5, outsideMinBleed: 0.5, safety: 0.5,
      coverBleed: 0.125, coverSafe: 0.25, ib: { out: 0.125, top: 0.125, bottom: 0.125, inn: 0 }, bleedAlways: false,
      barcode: 'required', isbn: 'required', lastBlank: true, cmyk: true,
      trims: ['5x8', '5.06x7.81', '5.25x8', '5.5x8.5', '5.83x8.27', '6x9', '6.14x9.21', '6.69x9.61', '7x10', '7.44x9.69', '7.5x9.25', '8x10', '8.5x8.5', '8.25x11', '8.27x11.69', '8.5x11'],
      template: 'https://myaccount.ingramspark.com/Portal/Tools/CoverTemplateGenerator',
      notes: ['IngramSpark publishes no spine formula. The width here is an estimate from typical paper bulk.']
    },
    lulu: {
      name: 'Lulu', short: 'Lulu', exact: true,
      spine: p => p / 444 + 0.06,
      pages: { white: [32, 800], cream: [32, 800], 'color-std': [32, 800], 'color-prem': [32, 800] },
      spineTextMin: 81, spineSafe: 0.125, gutter: () => 0.7, outsideMin: 0.5, outsideMinBleed: 0.5, safety: 0.5,
      coverBleed: 0.125, coverSafe: 0.25, ib: { out: 0.125, top: 0.125, bottom: 0.125, inn: 0.125 }, bleedAlways: true,
      barcode: 'optional', isbn: 'optional',
      trims: ['5x8', '5.5x8.5', '5.83x8.27', '6x9', '6.14x9.21', '7x10', '7.44x9.69', '8.5x8.5', '8.27x11.69', '8.5x11'],
      template: 'https://www.lulu.com/publish/books',
      notes: ['Lulu wants every interior page sized with 0.125 in bleed on all four sides.']
    },
    d2d: {
      name: 'Draft2Digital Print', short: 'D2D', exact: false,
      spine: (p, paper) => p / ({ white: 512, cream: 444, 'color-std': 512, 'color-prem': 377 })[paper],
      pages: { white: [64, 740], cream: [64, 740], 'color-std': [64, 740], 'color-prem': [64, 740] },
      spineTextMin: 48, spineSafe: 0.0625, gutter: () => 0.5, outsideMin: 0.5, outsideMinBleed: 0.5, safety: 0.5,
      coverBleed: 0.125, coverSafe: 0.25, ib: { out: 0.125, top: 0.125, bottom: 0.125, inn: 0 }, bleedAlways: false,
      barcode: 'auto', isbn: 'optional', bwOnly: true,
      trims: ['5x8', '5.25x8.5', '5.5x8.5', '6x9', '7.5x9.25', '8.5x11'],
      template: 'https://www.draft2digital.com/',
      notes: ['D2D Print runs on Ingram presses and builds its own cover template; the spine here is an estimate.']
    },
    bn: {
      name: 'Barnes & Noble Press', short: 'B&N Press', exact: false,
      spine: (p, paper) => p * ({ white: 0.002252, cream: 0.0025, 'color-std': 0.002252, 'color-prem': 0.002347 })[paper],
      pages: { white: [18, 800], cream: [18, 800], 'color-std': [18, 800], 'color-prem': [18, 800] },
      spineTextMin: 80, spineSafe: 0.0625, gutter: kdpGutter, outsideMin: 0.25, outsideMinBleed: 0.375, safety: 0.25,
      coverBleed: 0.125, coverSafe: 0.25, ib: { out: 0.125, top: 0.125, bottom: 0.125, inn: 0 }, bleedAlways: false,
      barcode: 'auto', isbn: 'optional',
      trims: ['5x8', '5.25x8', '5.5x8.5', '6x9', '6.14x9.21', '7x10', '7.44x9.69', '7.5x9.25', '8x10', '8.25x11', '8.27x11.69', '8.5x11'],
      template: 'https://press.barnesandnoble.com/',
      notes: ['B&N Press publishes no spine formula; its Cover Template Tool is the authority.']
    },
    bookvault: {
      name: 'BookVault', short: 'BookVault', exact: false,
      spine: (p, paper) => (p * ({ white: 0.05, cream: 0.058, 'color-std': 0.05, 'color-prem': 0.06 })[paper] + 1) / 25.4,
      pages: { white: [24, 1000], cream: [24, 1000], 'color-std': [24, 1000], 'color-prem': [24, 1000] },
      spineTextMin: 80, spineSafe: 0.08, gutter: () => 0.5, outsideMin: 0.4, outsideMinBleed: 0.4, safety: 0.4,
      coverBleed: 3 / 25.4, coverSafe: 0.25, ib: { out: 3 / 25.4, top: 3 / 25.4, bottom: 3 / 25.4, inn: 3 / 25.4 }, bleedAlways: true,
      barcode: 'optional', isbn: 'optional', lastBlank: true,
      trims: ALL,
      template: 'https://bookvault.app/',
      notes: ['BookVault works in millimetres with 3 mm bleed on every edge; take the spine from its sizing calculator.']
    }
  };
  BF.STORE_IDS = Object.keys(BF.STORES);

  BF.FONT_FAMILIES = {
    pagella: { label: 'Pagella (Palatino style)', kind: 'serif', css: 'Palatino Linotype, Palatino, Georgia, serif', word: 'Palatino Linotype' },
    termes: { label: 'Termes (Times style)', kind: 'serif', css: 'Times New Roman, Times, serif', word: 'Times New Roman' },
    schola: { label: 'Schola (Century Schoolbook style)', kind: 'serif', css: 'Century Schoolbook, Georgia, serif', word: 'Century Schoolbook' },
    caladea: { label: 'Caladea (Cambria style)', kind: 'serif', css: 'Cambria, Georgia, serif', word: 'Cambria' },
    heros: { label: 'Heros (Helvetica style)', kind: 'sans', css: 'Helvetica, Arial, sans-serif', word: 'Arial' },
    poppins: { label: 'Poppins (geometric sans)', kind: 'sans', css: 'Poppins, Century Gothic, sans-serif', word: 'Century Gothic' }
  };

  BF.STYLES = {
    classic: { label: 'Classic', blurb: 'Centred openers, raised initial, book-face serif.', body: 'pagella', head: 'pagella', size: 10.5, lead: 1.38, para: 'indent', justify: true, hyphenate: true, initial: true,
      ch: { align: 'center', label: 'CHAPTER {W}', labelZ: 8.5, labelLs: 2, labelB: false, titleZ: 21, titleB: false, titleI: false, rule: 'short', drop: 0.15 }, h2: { z: 12.5, b: true, i: false, fam: 'body' }, run: 'center', folio: 'bottom-center' },
    modern: { label: 'Modern', blurb: 'Left-set openers with a large numeral, sans headings.', body: 'caladea', head: 'poppins', size: 10.5, lead: 1.42, para: 'indent', justify: true, hyphenate: true, initial: false,
      ch: { align: 'left', label: '{00}', labelZ: 42, labelLs: 0, labelB: true, labelC: 0.72, titleZ: 21, titleB: true, titleI: false, rule: 'none', drop: 0.06 }, h2: { z: 12, b: true, i: false, fam: 'head' }, run: 'outside', folio: 'head' },
    business: { label: 'Non-fiction', blurb: 'Block paragraphs, firm rules, clear section heads.', body: 'schola', head: 'heros', size: 10, lead: 1.45, para: 'block', justify: true, hyphenate: true, initial: false,
      ch: { align: 'left', label: 'CHAPTER {N}', labelZ: 8.5, labelLs: 1.5, labelB: true, titleZ: 24, titleB: true, titleI: false, rule: 'bar', drop: 0.08 }, h2: { z: 12.5, b: true, i: false, fam: 'head' }, run: 'outside', folio: 'bottom-outside' },
    literary: { label: 'Literary', blurb: 'Quiet numerals, spaced capitals, generous air.', body: 'termes', head: 'termes', size: 11, lead: 1.36, para: 'indent', justify: true, hyphenate: true, initial: true,
      ch: { align: 'center', label: '{N}', labelZ: 16, labelLs: 0, labelB: false, titleZ: 13, titleB: false, titleI: false, titleCaps: true, titleLs: 2.2, rule: 'dots', drop: 0.2 }, h2: { z: 11, b: false, i: true, fam: 'body' }, run: 'center-caps', folio: 'bottom-center' },
    readable: { label: 'Readable', blurb: 'Larger type, open leading, ragged right for easy reading.', body: 'schola', head: 'schola', size: 12.5, lead: 1.45, para: 'indent', justify: false, hyphenate: false, initial: false,
      ch: { align: 'left', label: 'Chapter {N}', labelZ: 12, labelLs: 0, labelB: false, labelI: true, titleZ: 24, titleB: true, titleI: false, rule: 'none', drop: 0.08 }, h2: { z: 14, b: true, i: false, fam: 'body' }, run: 'none', folio: 'bottom-center' },
    handbook: { label: 'Prompt handbook', blurb: 'Sans body, tabbed chapter labels, built around prompt boxes.', body: 'heros', head: 'poppins', size: 9.5, lead: 1.5, para: 'block', justify: false, hyphenate: false, initial: false,
      ch: { align: 'left', label: 'CHAPTER {00}', labelZ: 8, labelLs: 1.5, labelB: true, labelBox: true, titleZ: 25, titleB: true, titleI: false, rule: 'none', drop: 0.05 }, h2: { z: 12.5, b: true, i: false, fam: 'head', mark: true }, run: 'outside', folio: 'bottom-outside' }
  };
  BF.PROMPT_LABELS = ['Prompt', 'System prompt', 'Image prompt', 'Video prompt', 'Negative prompt', 'Output', 'Note'];
  BF.PROMPT_LOOKS = { shaded: 'Shaded', outline: 'Outlined', dark: 'Dark terminal' };

  BF.resolveStyle = function (setup) {
    const b = BF.STYLES[setup.style] || BF.STYLES.classic;
    const s = Object.assign({}, b, { ch: Object.assign({}, b.ch), h2: Object.assign({}, b.h2) });
    if (setup.bodyFont && BF.FONT_FAMILIES[setup.bodyFont]) s.body = setup.bodyFont;
    if (setup.headFont && BF.FONT_FAMILIES[setup.headFont]) s.head = setup.headFont;
    if (setup.bodySize) s.size = +setup.bodySize;
    if (setup.leading) s.lead = +setup.leading;
    if (setup.para) s.para = setup.para;
    if (setup.justify != null) s.justify = !!setup.justify;
    if (setup.hyphenate != null) s.hyphenate = !!setup.hyphenate;
    if (setup.initial != null) s.initial = !!setup.initial;
    if (setup.runHeads === false) s.run = 'none';
    s.leadPt = Math.round(s.size * s.lead * 2) / 2;
    return s;
  };

  BF.activeStores = setup => (setup.stores || []).filter(id => BF.STORES[id]);

  /* Interior geometry in points. Margins are worked out from trim, page count and the
     strictest selected store, unless the user typed their own. */
  BF.geometry = function (setup, pageCount) {
    const t = BF.trim(setup.trim), IN = BF.IN, W = t.w * IN, H = t.h * IN;
    const stores = BF.activeStores(setup).map(id => BF.STORES[id]);
    const bleed = !!setup.fullBleed;
    const need = {
      inside: Math.max(0.375, ...stores.map(s => s.gutter(pageCount))),
      outside: Math.max(0.25, ...stores.map(s => bleed ? s.outsideMinBleed : s.outsideMin)),
      safety: Math.max(0.25, ...stores.map(s => s.safety))
    };
    let m;
    if (setup.customMargins) {
      const c = setup.customMargins;
      m = { top: +c.top || 0.8, bottom: +c.bottom || 0.85, inside: +c.inside || 0.8, outside: +c.outside || 0.6 };
    } else {
      const k = Math.min(1.2, Math.max(0.88, t.w / 6)), cf = ({ compact: 0.9, standard: 1, generous: 1.15 })[setup.comfort || 'standard'];
      m = {
        top: Math.max(0.5 + 0.34, 0.85 * k * cf), bottom: Math.max(0.5 + 0.36, 0.9 * k * cf),
        outside: Math.max(need.outside, 0.625 * k * cf),
        inside: Math.max(need.inside, Math.max(0.8 * k * cf, need.inside + 0.2 * cf))
      };
      for (const key in m) m[key] = Math.round(m[key] * 200) / 200;
    }
    return { W, H, trim: t, need, auto: !setup.customMargins, mIn: m, m: { top: m.top * IN, bottom: m.bottom * IN, inside: m.inside * IN, outside: m.outside * IN } };
  };

  BF.spineInches = function (storeId, pages, setup) {
    const ov = setup.spineOverride && +setup.spineOverride[storeId];
    if (ov > 0) return { w: ov, source: 'override' };
    const s = BF.STORES[storeId];
    return { w: s.spine(pages, setup.paper), source: s.exact ? 'formula' : 'estimate' };
  };

  BF.cleanIsbn = s => String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase();
  BF.isbn13 = function (s) {
    let d = BF.cleanIsbn(s);
    if (d.length === 10) {
      let sum = 0; for (let i = 0; i < 10; i++) sum += (d[i] === 'X' ? 10 : +d[i]) * (10 - i);
      if (sum % 11 !== 0) return null;
      d = '978' + d.slice(0, 9); let t = 0; for (let i = 0; i < 12; i++) t += +d[i] * (i % 2 ? 3 : 1);
      return d + ((10 - t % 10) % 10);
    }
    if (!/^\d{13}$/.test(d)) return null;
    let t = 0; for (let i = 0; i < 12; i++) t += +d[i] * (i % 2 ? 3 : 1);
    return (10 - t % 10) % 10 === +d[12] ? d : null;
  };

  const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  BF.numWord = n => n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '') : String(n);
  BF.roman = n => { const m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
})(typeof globalThis !== 'undefined' ? globalThis : this);
