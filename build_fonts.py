#!/usr/bin/env python3
"""Subset open-licensed fonts to Latin, flatten GPOS kerning into a legacy
'kern' table, convert CFF outlines to TrueType, and emit src/fonts.js.
Also extracts TeX hyphenation patterns into src/hyph.js."""
import base64, json, os, re, sys
from fontTools.ttLib import TTFont, newTable
from fontTools.subset import Subsetter, Options
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables._k_e_r_n import KernTable_format_0

HERE = os.path.dirname(os.path.abspath(__file__))
TG = '/usr/share/texmf/fonts/opentype/public/tex-gyre/'
FAMILIES = {
    'pagella': [TG + 'texgyrepagella-%s.otf' % s for s in ('regular', 'italic', 'bold', 'bolditalic')],
    'termes': [TG + 'texgyretermes-%s.otf' % s for s in ('regular', 'italic', 'bold', 'bolditalic')],
    'schola': [TG + 'texgyreschola-%s.otf' % s for s in ('regular', 'italic', 'bold', 'bolditalic')],
    'caladea': ['/usr/share/fonts/truetype/crosextra/Caladea-%s.ttf' % s for s in ('Regular', 'Italic', 'Bold', 'BoldItalic')],
    'heros': [TG + 'texgyreheros-%s.otf' % s for s in ('regular', 'italic', 'bold', 'bolditalic')],
    'poppins': ['/usr/share/fonts/truetype/google-fonts/Poppins-%s.ttf' % s for s in ('Regular', 'Italic', 'Bold', 'BoldItalic')],
    'mono': ['/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', None, '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', None],
}
SUFFIX = ['r', 'i', 'b', 'bi']

LATIN = list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + [
    0x2002, 0x2003, 0x2009, 0x200A, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2018, 0x2019, 0x201A,
    0x201C, 0x201D, 0x201E, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2032, 0x2033, 0x2039, 0x203A, 0x2044,
    0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x2260, 0x2264, 0x2265, 0x221E, 0x2248, 0x25A0,
    0x25CF, 0x25CB, 0x2713, 0x2605, 0x02C6, 0x02DC, 0x2116, 0x00B7]
# The mono face carries prompt text, which can hold almost anything: keep more.
MONO_EXTRA = list(range(0x180, 0x250)) + list(range(0x370, 0x400)) + list(range(0x400, 0x460)) + \
    list(range(0x2190, 0x2200)) + list(range(0x2200, 0x2270)) + list(range(0x2500, 0x25A0)) + \
    list(range(0x25A0, 0x2600)) + [0x2318, 0x23CE, 0x2713, 0x2717, 0x2026, 0x21B5]

KERNABLE = list(range(0x21, 0x7F)) + [0x2018, 0x2019, 0x201C, 0x201D, 0x2013, 0x2014, 0x2026] + \
    [c for c in range(0xC0, 0x100) if c not in (0xD7, 0xF7)]


def gpos_pairs(font, glyphs):
    """Resolve pair kerning (GPOS 'kern', PairPos formats 1 and 2) for a glyph set."""
    if 'GPOS' not in font:
        return {}
    gpos = font['GPOS'].table
    idxs = set()
    for fr in gpos.FeatureList.FeatureRecord:
        if fr.FeatureTag == 'kern':
            idxs.update(fr.Feature.LookupListIndex)
    out = {}
    gl = list(glyphs)
    for li in sorted(idxs):
        lk = gpos.LookupList.Lookup[li]
        subs = []
        for st in lk.SubTable:
            if lk.LookupType == 9:
                if st.ExtensionLookupType != 2:
                    continue
                st = st.ExtSubTable
            elif lk.LookupType != 2:
                continue
            subs.append(st)
        prepared = []
        for st in subs:
            cov = {g: i for i, g in enumerate(st.Coverage.glyphs)}
            if st.Format == 1:
                sets = []
                for ps in st.PairSet:
                    d = {}
                    for pvr in ps.PairValueRecord:
                        v = pvr.Value1.XAdvance if pvr.Value1 is not None and hasattr(pvr.Value1, 'XAdvance') else 0
                        d[pvr.SecondGlyph] = v or 0
                    sets.append(d)
                prepared.append((1, cov, sets))
            else:
                prepared.append((2, cov, st))
        for g1 in gl:
            for g2 in gl:
                for kind, cov, data in prepared:
                    if g1 not in cov:
                        continue
                    if kind == 1:
                        d = data[cov[g1]]
                        if g2 in d:
                            if d[g2]:
                                out[(g1, g2)] = out.get((g1, g2), 0) + d[g2]
                            break
                    else:
                        st = data
                        c1 = st.ClassDef1.classDefs.get(g1, 0) if st.ClassDef1 else 0
                        c2 = st.ClassDef2.classDefs.get(g2, 0) if st.ClassDef2 else 0
                        rec = st.Class1Record[c1].Class2Record[c2]
                        v = rec.Value1.XAdvance if rec.Value1 is not None and hasattr(rec.Value1, 'XAdvance') else 0
                        if v:
                            out[(g1, g2)] = out.get((g1, g2), 0) + v
                        break
    return out


def otf_to_ttf(font):
    order = font.getGlyphOrder()
    gs = font.getGlyphSet()
    glyf = newTable('glyf')
    glyf.glyphOrder = order
    glyf.glyphs = {}
    for name in order:
        pen = TTGlyphPen(gs)
        gs[name].draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
        glyf.glyphs[name] = pen.glyph()
    font['loca'] = newTable('loca')
    font['glyf'] = glyf
    del font['CFF ']
    if 'VORG' in font:
        del font['VORG']
    maxp = font['maxp']
    maxp.tableVersion = 0x00010000
    for a in ('maxZones', 'maxTwilightPoints', 'maxStorage', 'maxFunctionDefs', 'maxInstructionDefs',
              'maxStackElements', 'maxSizeOfInstructions', 'maxComponentElements', 'maxPoints', 'maxContours',
              'maxCompositePoints', 'maxCompositeContours', 'maxComponentDepth'):
        setattr(maxp, a, 0)
    maxp.maxZones = 1
    font.sfntVersion = '\x00\x01\x00\x00'


def build_font(path, extra):
    font = TTFont(path)
    cmap = font.getBestCmap()
    want = [c for c in LATIN + extra if c in cmap]
    opts = Options()
    opts.layout_features = ['kern']
    opts.name_IDs = [1, 2, 4, 6]
    opts.notdef_outline = True
    opts.hinting = False
    opts.glyph_names = False
    opts.drop_tables += ['DSIG', 'FFTM', 'GDEF', 'GSUB', 'gasp', 'cvt ', 'fpgm', 'prep', 'meta', 'MATH']
    sub = Subsetter(opts)
    sub.populate(unicodes=want)
    sub.subset(font)
    cmap = font.getBestCmap()
    kglyphs = [cmap[c] for c in KERNABLE if c in cmap]
    pairs = {k: v for k, v in gpos_pairs(font, kglyphs).items() if abs(v) >= 8}
    for t in ('GPOS', 'GSUB', 'GDEF'):
        if t in font:
            del font[t]
    if 'CFF ' in font:
        otf_to_ttf(font)
    if pairs:
        kern = newTable('kern')
        kern.version = 0
        st = KernTable_format_0()
        st.version = 0
        st.coverage = 1
        st.tupleIndex = None
        st.apple = False
        st.kernTable = pairs
        kern.kernTables = [st]
        font['kern'] = kern
    font['post'].formatType = 3.0
    tmp = '/tmp/_bf_font.ttf'
    font.save(tmp)
    data = open(tmp, 'rb').read()
    return data, len(pairs), len(font.getGlyphOrder())


def main():
    os.makedirs(os.path.join(HERE, 'src'), exist_ok=True)
    os.makedirs(os.path.join(HERE, 'fonts'), exist_ok=True)
    out = {}
    total = 0
    for fam, files in FAMILIES.items():
        for suf, path in zip(SUFFIX, files):
            if not path:
                continue
            data, npairs, ng = build_font(path, MONO_EXTRA if fam == 'mono' else [])
            key = '%s-%s' % (fam, suf)
            out[key] = base64.b64encode(data).decode()
            open(os.path.join(HERE, 'fonts', key + '.ttf'), 'wb').write(data)
            total += len(data)
            print('%-12s %6d bytes  %4d glyphs  %5d kern pairs' % (key, len(data), ng, npairs))
    with open(os.path.join(HERE, 'src', 'fonts.js'), 'w') as f:
        f.write('(function(G){var BF=G.BF=G.BF||{};BF.FONT_B64=' + json.dumps(out, separators=(',', ':')) + ';})(typeof globalThis!=="undefined"?globalThis:this);\n')
    print('total font bytes', total)

    tex = open('/usr/share/texlive/texmf-dist/tex/generic/hyphen/hyphen.tex').read()
    pats = re.search(r'\\patterns\{(.*?)\}', tex, re.S).group(1)
    pats = ' '.join(l.split('%')[0].strip() for l in pats.splitlines() if l.split('%')[0].strip())
    exc = re.search(r'\\hyphenation\{(.*?)\}', tex, re.S).group(1)
    exc = ' '.join(l.split('%')[0].strip() for l in exc.splitlines() if l.split('%')[0].strip())
    with open(os.path.join(HERE, 'src', 'hyph.js'), 'w') as f:
        f.write('/* English hyphenation patterns from Knuth & Liang (TeX hyphen.tex), extracted. */\n')
        f.write('(function(G){var BF=G.BF=G.BF||{};BF.HYPH_PAT=' + json.dumps(pats) + ';BF.HYPH_EXC=' + json.dumps(exc) + ';})(typeof globalThis!=="undefined"?globalThis:this);\n')
    print('patterns', len(pats.split()), 'exceptions', len(exc.split()))


if __name__ == '__main__':
    main()
