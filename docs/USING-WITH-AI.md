# Using Booksformatter with ChatGPT, Claude or another AI

Booksformatter is a web page, not a chatbot plug-in. It does not need an AI, and no AI needs to be connected to it. An assistant is useful for two jobs:

1. Getting your draft into the manuscript format, so the app can read all of it in one paste.
2. Running the formatter for you, if the assistant can run code.

## 1. Any chat assistant: prepare the manuscript

This works in ChatGPT, Claude, Gemini, Copilot or any other chat assistant.

1. Copy the prompt below into a new chat.
2. Paste your manuscript under it, or attach the file. For a long book, send a few chapters at a time and join the results.
3. Copy the assistant's reply.
4. In the app, choose **Paste text**, paste, and press **Import text**. The title, author, trim size and other header details are filled in for you.
5. Add your pictures with the **Add image** buttons, check the pages, and export.

### The prompt

````
You are preparing a book manuscript for Booksformatter, a tool that turns Markdown
into print and ebook files. Convert the manuscript I give you into the format below.

Do not rewrite, shorten, summarise or correct my text. Change only the markup.

FORMAT

1. Start with a header between two lines of three dashes. Write one "key: value" per
   line. If a value runs over several lines, indent the following lines by two spaces.
   Use only these keys, and leave out any you cannot fill from my text:
   title, subtitle, author, publisher, isbn, dedication, epigraph, epigraph-source,
   back-headline, blurb, bio, stores, trim, paper, style

   stores: any of kdp, ingram, lulu, d2d, bn, bookvault, separated by commas
   trim:   a size such as 5x8, 5.5x8.5, 6x9, 7x10 or 8.5x11
   paper:  white, cream, color-std or color-prem
   style:  classic, modern, business, literary, readable or handbook

2. "# " starts a new chapter, or a front or back matter piece such as Preface,
   Introduction, Acknowledgements or About the Author. Do not number chapters:
   write "# The Title", not "# Chapter 3: The Title".

3. "## " is a section heading inside a chapter. "### " is a smaller heading.

4. Separate paragraphs with one blank line. Use *italic*, **bold**, "- " for bullet
   lists, "1. " for numbered lists and "> " for quotations. Put *** on its own line
   for a scene break.

5. Any prompt, system prompt or other text the reader is meant to type into an AI
   tool goes in a block fenced with three backticks. After the opening backticks
   write the label, then optionally the tool and the look, separated by " | ".
   Labels: Prompt, System prompt, Image prompt, Video prompt, Negative prompt,
   Output, Note. Looks: shaded, outline, dark.
   Example opening line: ```Video prompt | Runway, 6 seconds | dark
   Keep the text inside the block exactly as I wrote it.

6. Where a picture belongs, put ![Caption](file-name.jpg) on its own line. A picture
   line directly under a "# " heading becomes that chapter's opening image.

Reply with the converted manuscript only. Put all of it in one code block fenced
with four backticks, so the three-backtick blocks inside it survive.

MY BOOK DETAILS
Stores: [for example kdp, ingram]
Trim size: [for example 6x9]
Paper: [white or cream]
Style: [for example business]

MY MANUSCRIPT
[paste here]
````

Read the result before you import it. An assistant can drop or alter text in a long manuscript, which is why the prompt forbids rewriting and why sending a few chapters at a time is safer than sending a whole book.

## 2. Assistants that can run code: build the files

This works with coding assistants that have a terminal and Node.js 18 or later: Claude Code, Codex, Cursor, Gemini CLI and similar. It also works in a chat assistant's code sandbox if that sandbox has Node.js; if it does not, use route 1.

Give the assistant your manuscript and an instruction such as:

```
Clone https://github.com/donsajith/Booksformatter and read AGENTS.md.
Format my-book.docx text as a 6x9 paperback on cream paper for KDP and IngramSpark,
in the business style. Convert it to the Booksformatter manuscript format first,
run the command line, and give me the files and the preflight report.
```

The assistant converts the manuscript, runs `node cli.mjs`, and hands back the interior PDFs, wrap covers, EPUB, Word file and preflight report.

Three things the command line cannot do, so finish them in the app if you need them:

- Import a Word file directly. The assistant has to convert it to Markdown first.
- Convert colour pictures to greyscale for a black-ink interior.
- Draw the ebook cover image. Give it finished cover art with `cover-image:` instead.

## 3. Changing the formatter itself

The code is MIT-licensed and has no dependencies. Ask a coding assistant to add a trim size, a store or an interior style; `AGENTS.md` tells it where things live and how to test.
