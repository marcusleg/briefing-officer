export const systemPrompt =
  "You are an expert at summarizing articles for professionals who want to quickly understand the key facts and takeaways.";

export const buildSummaryPrompt = (textContent: string) =>
  `Write a summary in the following structure and **format your response in Markdown**:

Use a level 3 heading (\`###\`) titled "Key Facts" for factual articles or "Key Takeaways" for opinion pieces, followed by a bullet list of 5–12 bullets. Highlight one keyword or key term per bullet point in bold.

Below is the article:

${textContent}`;

export const buildLeadPrompt = (title: string, textContent: string) =>
  `Write a single, continuous lead that is factual, objective, and provides an overview of what the article is about and why it is worth reading. The lead must be **no longer than 80 words**. Do not add any introduction, headings, or repeated information.
${title}\n\n${textContent}`;
