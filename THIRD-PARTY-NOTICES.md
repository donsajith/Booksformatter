# Third-party notices

Booksformatter's own code is under the MIT Licence (see `LICENSE`). It bundles the fonts and hyphenation patterns below, which stay under their own licences. The full licence texts are in the `licenses/` folder.

## Fonts

The files in `fonts/`, and the copies embedded in `src/fonts.js` and `index.html`, are **modified versions** of the original fonts. `build_fonts.py` reduces each font to Latin characters, converts its outlines to TrueType where needed, and rewrites its kerning into a `kern` table. They are not the complete original fonts. Booksformatter embeds them in the PDF files it produces under internal names beginning `BF-`.

| Font in Booksformatter | Original | Copyright | Licence |
|---|---|---|---|
| Pagella | TeX Gyre Pagella | Copyright 2006-2018 for TeX Gyre extensions by B. Jackowski, J.M. Nowacki, et al. (on behalf of TeX users groups) | GUST Font License |
| Termes | TeX Gyre Termes | Copyright 2006, 2009 for TeX Gyre extensions by B. Jackowski and J.M. Nowacki (on behalf of TeX users groups) | GUST Font License |
| Schola | TeX Gyre Schola | Copyright 2006, 2009 for TeX Gyre extensions by B. Jackowski and J.M. Nowacki (on behalf of TeX users groups) | GUST Font License |
| Heros | TeX Gyre Heros | Copyright 2006, 2009 for TeX Gyre extensions by B. Jackowski and J.M. Nowacki (on behalf of TeX users groups) | GUST Font License |
| Caladea | Caladea | Copyright 2012 The Caladea Project Authors (https://github.com/huertatipografica/Caladea) | SIL Open Font License 1.1 |
| Poppins | Poppins | Copyright 2020 The Poppins Project Authors (https://github.com/itfoundry/Poppins) | SIL Open Font License 1.1 |
| Mono | DejaVu Sans Mono | Copyright (c) 2003 by Bitstream, Inc. All Rights Reserved. DejaVu changes are in public domain | Bitstream Vera licence |

Licence texts:

- `licenses/GUST-FONT-LICENSE.txt`. The GUST Font License is the LaTeX Project Public License 1.3c with one added request. The LPPL text is at https://www.latex-project.org/lppl.txt. The original TeX Gyre fonts are available from https://www.gust.org.pl/projects/e-foundry/tex-gyre.
- `licenses/OFL-1.1.txt`. Applies to Caladea and Poppins. Under this licence the fonts, including these modified versions, may not be sold by themselves.
- `licenses/BITSTREAM-VERA.txt`. Applies to DejaVu Sans Mono.

## Hyphenation patterns

`src/hyph.js` contains the English hyphenation patterns from `hyphen.tex` by Donald E. Knuth and Frank M. Liang, extracted into a JavaScript string. The original file states:

> Unlimited copying and redistribution of this file are permitted as long as this file is not modified. Modifications are permitted, but only if the resulting file is not named hyphen.tex.

## App interface fonts

When online, the app loads Archivo, IBM Plex Sans and IBM Plex Mono from Google Fonts for its own interface. They are not bundled in this repository and are not embedded in any file the app produces.
