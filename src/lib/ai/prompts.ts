export const systemPrompt =
  "You are an expert at summarizing articles for professionals who want to quickly understand core content, key facts, and main arguments.";

export const buildSummaryPrompt = (textContent: string) =>
  `Write a summary in the following structure and **format your response in Markdown**:

- Key Points (as a bullet list; use "Key Facts" for factual articles or "Key Takeaways" for opinion pieces)
  Highlight one keywords or key term per bullet point in bold.
- Executive Summary
  Focus on a high information density while maintaining clear, readable language. Include all major points, arguments, or findings that are most relevant to understanding the article as a whole. Do not simply copy text verbatim — paraphrase and condense where appropriate.
  Use paragraphs with headings to logically organize the information and emphasize key points. For major sections, use level 4 headings (\`####\`). For subsections that provide additional detail or clarification, use level 5 headings (\`#####\`). Feel free to include unstructured paragraphs when appropriate for smooth narrative flow.
- Why the Full Article Is Worth Reading
  Only include this section if the full article offers additional detail, nuance, or unique value that is not fully captured in your summary. If the summary sufficiently covers all key content, you may omit this section.

 Each should use a level 3 headings (\`###\`) with the respective content underneath:

Below is the article:

${textContent}`;

export const buildLeadPrompt = (title: string, textContent: string) =>
  `Write a single, continuous lead that is factual, objective, and provides an overview of what the article is about and why it is worth reading. The lead must be **no longer than 80 words**. Do not add any introduction, headings, or repeated information.
${title}\n\n${textContent}`;
