# Manuscript format

Booksformatter reads Markdown. The same file works three ways: paste it into the app, import it as a `.md` file, or pass it to the command line.

A complete example is in [`examples/manuscript.md`](../examples/manuscript.md).

## The text

| Write | To get |
|---|---|
| `# Title` | A new chapter. Titles such as Preface, Introduction, Acknowledgements and About the Author become front or back matter |
| `## Heading` | A section heading inside the chapter |
| `### Heading` | A smaller heading |
| A blank line | A new paragraph |
| `*italic*` and `**bold**` | Italic and bold |
| `- item` | A bullet list |
| `1. item` | A numbered list |
| `> text` | A quotation |
| `***` on its own line | A scene break |
| `===` on its own line | A page break |

Do not number chapters yourself. Write `# What a Prompt Really Is`, not `# Chapter 1: What a Prompt Really Is`. The formatter numbers them.

## Prompt boxes

For books about AI prompting or AI video generation. A fenced block becomes a prompt box:

````
```Video prompt | Runway, 6 seconds | dark
SHOT: slow push-in, eye level, 35mm
SUBJECT: a baker slides a tray of loaves from a stone oven
```
````

After the three backticks comes the label, then optionally the tool and the look, separated by ` | `.

- **Label:** Prompt, System prompt, Image prompt, Video prompt, Negative prompt, Output, Note, or your own.
- **Tool:** any short text, such as the model name or clip length. Shown in the corner of the box.
- **Look:** `shaded`, `outline` or `dark`. Leave it out to use the book's default.

The text inside a prompt box is printed exactly as written. Quotes are not curled and words are not hyphenated, so a reader can type it as shown.

## Pictures

```
![A caption, or leave this empty](pictures/figure-1.jpg)
```

Put the line on its own. A picture line directly under a `# Title` line becomes that chapter's supporting image. Anywhere else, it is placed in the text at that point.

- **In the app:** text files cannot carry pictures, so the app lists the pictures the text names and you add each one with **Add image**.
- **On the command line:** the file is read from disk, relative to the manuscript. JPEG only.

## The header

Book details go at the very top of the file, between two lines of three dashes. One `key: value` per line. For a value that runs over several lines, indent the following lines by two spaces. Every key is optional.

```
---
title: Field Notes on Prompting
subtitle: A sample book
author: Sample Author
stores: kdp, ingram
trim: 6x9
paper: cream
style: handbook
blurb: The first paragraph of the back-cover text.

  The second paragraph, indented by two spaces.
---
```

| Key | Meaning |
|---|---|
| `title`, `subtitle`, `author`, `publisher`, `year`, `edition` | Title page and copyright page |
| `isbn` | Print ISBN, used for the cover barcode |
| `isbn-ebook` | Ebook ISBN, used as the EPUB identifier |
| `language` | Language code, such as `en` |
| `description` | Short description, stored in the EPUB |
| `copyright` | Your own copyright page text, replacing the standard one |
| `stores` | Any of `kdp`, `ingram`, `lulu`, `d2d`, `bn`, `bookvault`, separated by commas |
| `trim` | Trim size, such as `6x9` or `5.5x8.5` |
| `paper` | `white`, `cream`, `color-std` or `color-prem` |
| `style` | `classic`, `modern`, `business`, `literary`, `readable` or `handbook` |
| `prompt-box` | Default look for prompt boxes: `shaded`, `outline` or `dark` |
| `dedication`, `epigraph`, `epigraph-source` | Front matter pages |
| `contents` | `yes` or `no`: include a table of contents |
| `contents-title` | Heading for the contents page |
| `cover-template` | `band`, `classic`, `split` or `type` |
| `cover-color`, `cover-text-color`, `cover-accent` | Cover colours, as hex values such as `#14213d` |
| `cover-image` | Front-cover picture (command line: a JPEG file) |
| `back-headline`, `blurb`, `bio` | Back-cover text |
| `barcode`, `spine-text` | `yes` or `no` |
| `spine-ingram`, `spine-d2d`, `spine-bn`, `spine-bookvault` | Spine width in inches from the store's own cover template, replacing the estimate |

Run `node cli.mjs --list` to see every trim size, style, paper, store and cover template.

Chapter subtitles and picture sizes have no Markdown form. Set them in the app.
