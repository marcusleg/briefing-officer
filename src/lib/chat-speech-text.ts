import type { ListItem, Nodes } from "mdast";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";

/** The longest text /api/speech synthesizes in one request. */
export const MAX_SENTENCE_LENGTH = 4096;

// The syntax Streamdown renders answers with, so the spoken text follows what
// the reader sees. Streamdown treats a single dollar sign as text, so dollar
// amounts are read and only double dollars are math.
const parser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath, { singleDollarTextMath: false });

const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });

/** Nodes that are not prose: read aloud they would be noise. */
const SKIPPED = new Set([
  "code",
  "definition",
  "footnoteDefinition",
  "footnoteReference",
  "html",
  "image",
  "imageReference",
  "inlineMath",
  "math",
]);

/** Nodes whose text is read as one block, split into sentences afterwards. */
const BLOCKS = new Set(["heading", "paragraph", "tableCell"]);

const PUNCTUATION_ONLY = /^[\s\p{P}]*$/u;

const inlineText = (node: Nodes): string => {
  if (SKIPPED.has(node.type)) return "";
  if (node.type === "break") return " ";
  if ("value" in node) return node.value;
  if ("children" in node) {
    return (node.children as Nodes[]).map(inlineText).join("");
  }
  return "";
};

/**
 * Answers end with a list of the articles they draw on, whose items are only
 * a link to an article. Read aloud, such a list is a string of headlines.
 */
const isCitation = (item: ListItem) => {
  const [only, ...rest] = item.children;
  if (rest.length > 0 || only?.type !== "paragraph") return false;

  return (
    only.children.some((child) => child.type === "link") &&
    only.children.every(
      (child) =>
        child.type === "link" ||
        (child.type === "text" && PUNCTUATION_ONLY.test(child.value)),
    )
  );
};

const collectBlocks = (node: Nodes, blocks: string[]) => {
  if (SKIPPED.has(node.type)) return;
  if (node.type === "listItem" && isCitation(node)) return;
  if (BLOCKS.has(node.type)) {
    blocks.push(inlineText(node));
    return;
  }
  if ("children" in node) {
    for (const child of node.children as Nodes[]) collectBlocks(child, blocks);
  }
};

/** Breaks text longer than the route accepts at the last space that fits. */
const capLength = (sentence: string): string[] => {
  const pieces: string[] = [];
  let rest = sentence;

  while (rest.length > MAX_SENTENCE_LENGTH) {
    const space = rest.lastIndexOf(" ", MAX_SENTENCE_LENGTH);
    const cut = space > 0 ? space : MAX_SENTENCE_LENGTH;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) pieces.push(rest);
  return pieces;
};

/**
 * The sentences to read aloud from a chat answer's Markdown.
 *
 * Each paragraph, heading, list item and table cell is split on its own, so a
 * heading or list item without a final period is still its own sentence.
 * Answers are read as English, so the segmenter's rules are English ones.
 */
export const spokenSentences = (markdown: string): string[] => {
  const blocks: string[] = [];
  collectBlocks(parser.parse(markdown), blocks);

  return blocks
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter((block) => block !== "")
    .flatMap((block) =>
      Array.from(segmenter.segment(block), ({ segment }) => segment.trim()),
    )
    .filter((sentence) => sentence !== "")
    .flatMap(capLength);
};
