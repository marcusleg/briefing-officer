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

/**
 * The relevance block is appended only when the feed has an interest profile,
 * so a feed without one produces exactly the prompt it produced before this
 * feature existed — same text, same token count.
 *
 * The decision is framed as "should this be excluded", never as "does this
 * match the reader's interests". Most profiles are written as exclusions —
 * "everything except X" — and against one of those, a match test inverts: an
 * article that mentions nothing the reader named scores as "no match" and gets
 * filtered, which is precisely backwards. A model asked the match question
 * produced exactly that, reasoning that an article "does not overlap with the
 * reader's stated interests of avoiding coverage about KDE and Apple hardware"
 * and then filtering it. The reasoning was right and the question was wrong.
 *
 * Keeping is therefore the default, and exclusion needs positive grounds.
 */
const relevanceDirective = (interestProfile: string) =>
  interestProfile === ""
    ? ""
    : `

The reader has described, in their own words, what they do and do not want to
read from this feed:

<reader_preferences>
${interestProfile}
</reader_preferences>

Read that description for its polarity before deciding. Most readers describe
what they do NOT want: a preference like "everything except X" means keep every
article that is not about X — the named topics are exclusions, not the only
acceptable subjects. Some readers instead name only what they do want, and some
do both. The wording tells you which.

Your decision is whether to exclude this article from the reader's inbox.
Keeping it is the default. Set \`excludeArticle\` to true only when the
preferences give a clear, positive reason to exclude this specific article —
that is, when the article is plainly about something the reader said they do
not want.

If the preferences do not speak to this article's subject at all, keep it. If
you are unsure, keep it. Hiding an article the reader wanted is far worse than
showing one they did not: whenever the two risks are close, keep it.

Report one sentence of reasoning as \`exclusionReason\`, naming the part of the
preferences you applied, then your decision as \`excludeArticle\`. Write the
reasoning in the same language as the lead.`;

export const buildLeadPrompt = (
  title: string,
  textContent: string,
  interestProfile: string,
) =>
  `Write a single paragraph summarizing what the article covers and why it is significant or timely. Be factual and objective. The summary must be no longer than 80 words. Do not copy the article's opening lines verbatim, and do not add introductory phrases, headings, or filler.

First determine the language the article is written in and report it as a two-letter ISO 639-1 code, for example "de" for German. If the language cannot be established, report "und". Write the lead in the language you reported.${relevanceDirective(interestProfile)}

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
 * Takes an object rather than positional arguments: three of the five fields
 * are plain strings, freely transposable at a call site without a type error.
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
