# Notes for AI coding agents

Booksformatter turns one manuscript into print and ebook files for Amazon KDP, IngramSpark, Lulu, Draft2Digital, Barnes & Noble Press and BookVault. It is plain JavaScript with no dependencies. The same engine runs in the browser (`index.html`) and under Node (`cli.mjs`).

## Formatting a book for someone

1. Convert their manuscript to the format in `docs/MANUSCRIPT-FORMAT.md`. Keep their words exactly; change only the markup. `examples/manuscript.md` is a complete example.
2. Run the command line (Node 18 or later, nothing to install):

   ```
   node cli.mjs their-book.md --out their-book-files --json
   ```

   `--json` prints page count, margins, spine widths, the files written and the preflight items. `node cli.mjs --list` shows every trim size, style, paper, store and cover template.
3. Read the preflight items. Exit code 1 means at least one item is marked `fix`: resolve it and run again. Exit code 2 means the command or the manuscript header was wrong.
4. Hand back the files and report the preflight items marked `check` in plain words. Do not describe an estimated spine width as exact: for IngramSpark, Draft2Digital, B&N Press and BookVault the person must take the width from the store's own cover template (header keys `spine-ingram`, `spine-d2d`, `spine-bn`, `spine-bookvault`).

Limits of the command line: Markdown or text input only, JPEG pictures only, no greyscale conversion, and no generated ebook cover image. Send the person to the browser app for those.

## Changing the code

- Source is in `src/`. After any change there, run `python3 build.py` to regenerate `index.html`, and commit both.
- Never edit `src/fonts.js` or `src/hyph.js` by hand. `build_fonts.py` generates them.
- Store rules (page limits, margins, bleed, spine maths) are in `src/specs.js`. Cite the store's help page in the commit message when you change one, and update `BF.SPEC_DATE`.
- Tests: `npm test` (engine and command line) and `python3 test/browser.py build` (full export in headless Chromium, needs Playwright). Test output goes to `test/out/`, which is not committed.
- The browser app must stay a single self-contained file that works offline and from `file://`. Do not add network requests that carry manuscript content.
- Regenerate `examples/output` only from the sample book, and keep `examples/manuscript.md` in step with `src/sample.js`.
