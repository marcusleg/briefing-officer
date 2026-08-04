export const systemPrompt =
  "You are a professional news editor writing article previews for a time-pressed professional readership. Write in a neutral, factual tone. Do not editorialize, express opinions, or draw conclusions not explicitly stated in the source material.";

export const buildSummaryPrompt = (title: string, textContent: string) =>
  `Write a summary using the following Markdown structure: Use a level 3 heading (###) titled "Key Facts" for news and factual reporting, "Key Takeaways" for opinion or commentary, or "Key Points" if the article type is unclear. Follow the heading with a bullet list of 5–12 bullets — fewer for short or focused articles, more for complex ones. Each bullet must be one concise sentence. Bold the single most important named entity, concept, or figure in each bullet.

<article>
<title>${title}</title>
<content>
${textContent}
</content>
</article>`;

export const buildLeadPrompt = (title: string, textContent: string) =>
  `Write a single paragraph summarizing what the article covers and why it is significant or timely. Be factual and objective. The summary must be no longer than 80 words. Do not copy the article's opening lines verbatim, and do not add introductory phrases, headings, or filler.

<article>
<title>${title}</title>
<content>
${textContent}
</content>
</article>`;

export const buildAudioScriptPrompt = (title: string, textContent: string) =>
  `Write the body of a spoken audio briefing that a text-to-speech voice will read aloud. The briefing has already been introduced with the article's title, author, and publication, so do not restate any of them and do not open with a greeting.

Write 150 to 200 words of continuous prose — roughly one minute of speech. Use short declarative sentences. Connect them with explicit transitions so the briefing flows when heard rather than read. Write numbers, symbols, and units the way they are spoken, for example "forty percent" rather than "40%". Avoid parenthetical asides, which cannot be heard.

Output plain text only. Do not use Markdown, headings, bullet lists, bold, or italics.

<article>
<title>${title}</title>
<content>
${textContent}
</content>
</article>`;
