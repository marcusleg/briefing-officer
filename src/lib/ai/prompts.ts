import { languageDisplayName } from "@/lib/language";

/**
 * The instruction that makes the output language deliberate rather than
 * inferred. Stated even when the language is English: the point is that every
 * generation is told what to write in, not that non-English is special-cased.
 */
const languageDirective = (language: string | null) =>
  `Write entirely in ${languageDisplayName(language)}.`;

export const systemPrompt =
  "You are a professional news editor writing article previews for a time-pressed professional readership. Write in a neutral, factual tone. Do not editorialize, express opinions, or draw conclusions not explicitly stated in the source material.";

export const buildLeadPrompt = (title: string, textContent: string) =>
  `Write a single paragraph summarizing what the article covers and why it is significant or timely. Be factual and objective. The summary must be no longer than 80 words. Do not copy the article's opening lines verbatim, and do not add introductory phrases, headings, or filler.

First determine the language the article is written in and report it as a two-letter ISO 639-1 code, for example "de" for German. If the language cannot be established, report "und". Write the lead in the language you reported.

<article>
<title>${title}</title>
<content>
${textContent}
</content>
</article>`;

export const buildSummaryPrompt = (
  title: string,
  textContent: string,
  language: string | null,
) =>
  `Write a summary using the following Markdown structure: Use a level 3 heading (###) titled "Key Facts" for news and factual reporting, "Key Takeaways" for opinion or commentary, or "Key Points" if the article type is unclear. Follow the heading with a bullet list of 5–12 bullets — fewer for short or focused articles, more for complex ones. Each bullet must be one concise sentence. Bold the single most important named entity, concept, or figure in each bullet.

${languageDirective(language)} The heading names above are given in English; translate the one you choose into that language.

<article>
<title>${title}</title>
<content>
${textContent}
</content>
</article>`;

/**
 * Takes an object rather than positional arguments: four of the five fields
 * are strings, and three of those are freely transposable at a call site
 * without a type error.
 */
export const buildAudioScriptPrompt = ({
  title,
  author,
  feedTitle,
  textContent,
  language,
}: {
  title: string;
  author: string | null;
  feedTitle: string;
  textContent: string;
  language: string | null;
}) => {
  // Omitted rather than left empty when unknown, so there is nothing in the
  // prompt for the model to invent an author from.
  const authorInstruction = author
    ? "naming the publication and the author"
    : "naming the publication — no author is known, so do not mention one";
  const authorElement = author ? `<author>${author}</author>\n` : "";

  return `Write a spoken audio briefing that a text-to-speech voice will read aloud.

The article's title has already been spoken aloud before your text begins. Never repeat, paraphrase, translate, or refer back to it. It appears below only as context for writing the body — treat it as already said.

Your first sentence must therefore be a single sentence ${authorInstruction}, phrased the way it would be said aloud. Then go straight into the briefing itself. Do not open with a greeting, and do not begin with a phrase that announces the article as an article — "The article titled", "This piece", "Der Artikel", or any equivalent. The listener has just heard the headline, so such openings carry no information.

After the introduction, write 150 to 200 words of continuous prose — roughly one minute of speech. Use short declarative sentences. Connect them with explicit transitions so the briefing flows when heard rather than read. Write numbers, symbols, and units the way they are spoken, for example "forty percent" rather than "40%". Avoid parenthetical asides, which cannot be heard.

Put each sentence on its own line, separated by a single newline. Do not leave blank lines between sentences.

Output plain text only. Do not use Markdown, headings, bullet lists, bold, or italics.

${languageDirective(language)}

<article>
<title>${title}</title>
${authorElement}<publication>${feedTitle}</publication>
<content>
${textContent}
</content>
</article>`;
};
