/* A short example manuscript so the app opens in a working state. Clearly labelled as a sample. */
(function (G) {
  'use strict';
  const BF = G.BF;
  BF.newBook = function () {
    return {
      v: 1,
      meta: { title: '', subtitle: '', author: '', publisher: '', year: String(new Date().getFullYear()), edition: 'First edition', isbnPrint: '', isbnEbook: '', lang: 'en', description: '', copyrightText: '' },
      setup: { stores: ['kdp', 'ingram'], trim: '6x9', paper: 'cream', style: 'classic', bodyFont: '', headFont: '', bodySize: '', leading: '', para: '', justify: null, hyphenate: null, initial: null, smart: true, chapterStart: 'recto', runHeads: true, comfort: 'standard', customMargins: null, fullBleed: false, promptLook: 'shaded', spineOverride: {} },
      front: { halfTitle: true, titlePage: true, copyright: true, dedication: '', epigraph: '', epigraphSource: '', toc: true, tocSections: false, tocTitle: 'Contents' },
      sections: [],
      cover: { template: 'band', bg: '#14213d', fg: '#ffffff', accent: '#fca311', titleFont: 'poppins', backFont: 'heros', frontImage: '', frontImageMode: 'top', overlayText: false, backImage: '', backHeadline: '', blurb: '', bio: '', barcode: true, spineText: true, spineAccent: false },
      images: {}
    };
  };
  const id = () => BF.uid();
  const T = md => ({ id: id(), type: 'text', md });
  const Hd = (text, level) => ({ id: id(), type: 'h', level: level || 2, text });
  const P = (label, tool, text, look) => ({ id: id(), type: 'prompt', label, tool, text, look: look || '' });
  BF.sampleBook = function () {
    const b = BF.newBook();
    b.sample = true;
    Object.assign(b.meta, { title: 'Field Notes on Prompting', subtitle: 'A sample book to show what the formatter produces', author: 'Sample Author', publisher: 'Example Press', isbnPrint: '978-1-4028-9462-6', description: 'A short sample manuscript about writing prompts for text, image and video models.' });
    b.setup.trim = '5.5x8.5';
    b.front.dedication = 'For everyone who has ever typed\n"make it better" and hoped.';
    b.front.epigraph = 'A good prompt is a brief you would be happy to hand to a talented stranger.';
    b.front.epigraphSource = 'Studio saying';
    Object.assign(b.cover, { backHeadline: 'Say what you mean. Get what you asked for.', blurb: 'This is sample back-cover copy. Replace it with the two or three short paragraphs that tell a browsing reader what the book will do for them.\n\nKeep it under 150 words so it clears the barcode. The formatter warns you if the text runs into the barcode area.', bio: 'Sample Author is a placeholder. Your own two-line biography goes here.' });
    b.sections = [
      { id: id(), kind: 'front', title: 'Preface', subtitle: '', numbered: false, image: null, blocks: [
        T('This is a sample manuscript. It exists so that you can see every part of the formatter working before you load your own book: front matter, chapter openers, section headings, pictures, lists, quotations and the prompt boxes used in books about AI.\n\nNothing here is meant to be published. Choose **Start a new book** or import your manuscript, and the sample disappears.')
      ] },
      { id: id(), kind: 'chapter', title: 'What a Prompt Really Is', subtitle: 'Briefs, not spells', numbered: true, image: { id: 'sample-a', place: 'above', caption: '' }, blocks: [
        T('Most people meet a language model the way they meet a search box. They type a few words, press return and judge the machine by what comes back. When the answer disappoints, they change a word or two and try again, as if the right incantation were hiding somewhere in the dictionary.\n\nIt is more useful to think of a prompt as a brief. A brief tells a capable colleague who the work is for, what it has to achieve, what good looks like and what to leave out. Nobody would hand a designer the instruction "make a poster" and expect the poster they had in mind. Yet that is how most first prompts read.\n\nThe difference shows up at once in practice. Compare a request that names nothing with one that names the reader, the purpose and the form.'),
        P('Prompt', 'Any chat model', 'Write a welcome email for new customers.'),
        P('Prompt', 'Any chat model', 'You are writing for a family-run bakery in Leeds.\nReader: someone who has just placed a first online order.\nGoal: confirm the order, say when it will arrive, and make them glad they chose a small shop.\nLength: under 120 words. Plain, warm, no exclamation marks.\nEnd with one line inviting them to reply with any allergies.'),
        T('The second version is longer, and every extra line removes a guess. That is the whole craft in miniature: *find the guesses and remove them*.'),
        Hd('The four things every brief needs'),
        T('However the request is worded, a model does better work when it knows four things.\n\n- Who it is writing for, and what that person already knows.\n- What the result has to achieve.\n- The form the answer should take: length, structure and tone.\n- What to avoid, including the mistakes you have already seen.\n\nNone of this requires special vocabulary. It requires the discipline to write down what you would otherwise assume.')
      ] },
      { id: id(), kind: 'chapter', title: 'Showing Instead of Telling', subtitle: '', numbered: true, image: null, blocks: [
        T('Adjectives are cheap. Ask for writing that is "punchy" or "professional" and the model has to decide what you mean by the word, which is rarely what you meant. One good example does the work of a paragraph of description.\n\nIf you have a piece that already sounds right, include it and say what you like about it. If you have a piece that sounds wrong, include that too and say why. Models are excellent mimics; give them something worth imitating.'),
        Hd('Examples that earn their place'),
        { id: id(), type: 'image', img: 'sample-b', caption: 'A sample figure. Section pictures sit in the text column and carry an optional caption.', size: 'large' },
        T('An example should be short enough to read at a glance and close enough to the real task that the pattern carries over. Three varied examples beat one long one, because the model can see what the three have in common.\n\n> The fastest way to explain a style is to show a paragraph in it. The second fastest does not exist.\n\nWhen the output drifts, resist the urge to add more adjectives. Replace the example instead.'),
        P('System prompt', 'Reusable', 'Match the voice of the sample below. Keep sentences under 20 words.\nNever use the words "delve", "unlock" or "journey".\n\nSAMPLE\nWe bake at four so the bread is still warm at seven. If we sell out, we sell out.', 'outline')
      ] },
      { id: id(), kind: 'chapter', title: 'Prompts for Pictures', subtitle: '', numbered: true, image: null, blocks: [
        T('Image models read differently from chat models. They respond to nouns and visual terms far more than to instructions, and the order of the words changes what dominates the frame. A workable habit is to describe the picture the way a photographer would label a contact sheet: subject first, then setting, then light, then lens and finish.'),
        P('Image prompt', 'Still image', 'A baker dusting flour over a wooden bench, early morning, window light from the left, shallow depth of field, 50mm, warm neutral palette, documentary style, fine grain', 'dark'),
        P('Negative prompt', 'Still image', 'text, watermark, extra fingers, plastic skin, oversaturated colours', 'dark'),
        T('Change one element at a time. If you alter the subject, the light and the lens in a single revision, you will not know which change improved the result.\n\n* * *\n\nKeep the prompts that work. A plain text file of proven recipes is worth more than any list of magic words, because the recipes are yours and you know why each line is there.')
      ] },
      { id: id(), kind: 'chapter', title: 'Prompts for Moving Pictures', subtitle: '', numbered: true, image: null, blocks: [
        T('Video adds two things a still does not have: time and a camera that moves. A prompt that ignores them leaves the model to invent both, and it usually invents something restless. Say how long the shot lasts, what changes during it and what the camera does.'),
        P('Video prompt', 'Text to video, 6 seconds', 'SHOT: slow push-in, eye level, 35mm\nSUBJECT: a baker slides a tray of loaves from a stone oven\nACTION: steam rises as the tray comes out; she sets it down and looks up\nLIGHT: warm oven glow against cool dawn light from a doorway\nSTYLE: natural colour, handheld feel, no cuts'),
        Hd('One shot, one idea'),
        T('The most common mistake is asking a single clip to tell a whole story. Write one shot per prompt and join the shots in an editor. Each clip then has one job, and a weak clip can be replaced without disturbing the rest.\n\n1. Decide what the viewer should notice in this shot.\n2. Describe the movement in the frame before the movement of the camera.\n3. Fix the style words once and reuse them in every prompt of the sequence.\n\nConsistency across shots comes from repeating the same description of the subject and the light, word for word.')
      ] },
      { id: id(), kind: 'chapter', title: 'Keeping a Prompt Library', subtitle: '', numbered: true, image: null, blocks: [
        T('A prompt that worked once is an anecdote. A prompt that has worked twenty times, with notes on when it fails, is a tool. The difference is record keeping.\n\nGive every saved prompt a name, a date, the model it was written for and one line on what it is good at. When a model is updated, run the saved prompts again and note what changed. This takes minutes and saves the slow discovery, weeks later, that a trusted recipe has quietly stopped working.'),
        Hd('What to write down'),
        T('For each entry, record the task, the full prompt, a sample of the output and the weakness you have noticed. The weakness is the most valuable line. It tells the next person, who may be you in six months, where to look first when the result disappoints.\n\nThat is all a library needs. The habit matters more than the software.')
      ] },
      { id: id(), kind: 'back', title: 'About the Author', subtitle: '', numbered: false, image: null, blocks: [
        T('Sample Author does not exist. This page shows where your own biography will appear, set in the same style as the rest of the book.')
      ] }
    ];
    return b;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
