"use client";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import ToolActivity, {
  type ChatToolPart,
} from "@/components/chat/tool-activity";
import type { ChatUIMessage } from "@/lib/ai/chat/tools";
import { cn } from "@/lib/utils";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import "katex/dist/katex.min.css";
import Link from "next/link";
import type { ComponentProps } from "react";
import { defaultRehypePlugins, type ExtraProps } from "streamdown";

/**
 * A path on this site or a footnote. Streamdown's link hardening has already
 * turned a protocol-relative `//host/path` into the same-origin `/path`.
 */
const isInApp = (href: string | undefined): href is string =>
  !!href &&
  (href.startsWith("#") || (href.startsWith("/") && !href.startsWith("//")));

/**
 * Links to the reader's own articles and footnotes stay in the tab; anything
 * else, such as the original source, opens in a new one. Streamdown adds
 * `target` and `rel` to every link and passes its syntax tree node, so in-tab
 * links drop the former and nothing passes the node on to the DOM. The model
 * picks the paths, so they are not prefetched before a click.
 */
const ChatLink = ({
  href,
  children,
  className,
  node: _node,
  target: _target,
  rel: _rel,
  ...props
}: ComponentProps<"a"> & ExtraProps) => {
  const linkClassName = cn(
    "text-primary hover:text-hover underline underline-offset-2",
    className,
  );

  if (isInApp(href)) {
    return (
      <Link href={href} prefetch={false} {...props} className={linkClassName}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      {...props}
      className={linkClassName}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
};

/**
 * Answers never load images. A hostile article can tell the model to put
 * reader data in an image URL, which the browser would fetch unasked, so an
 * image only ever shows its alt text.
 */
const ChatImage = ({ alt }: ComponentProps<"img"> & ExtraProps) =>
  alt ? <>{alt}</> : null;

const markdownComponents = { a: ChatLink, img: ChatImage };

type RehypePlugin = (typeof defaultRehypePlugins)[string];

/**
 * A blocked link stays as text marked "[blocked]", colored with a design token
 * instead of the plugin's default gray. No image prefix is allowed and data
 * images are off, so the plugin blocks every image as well, and the blocked
 * image shows only its alt text, like `ChatImage`, instead of a gray
 * "[Image blocked]" badge. `ChatImage` is the second guard.
 */
const hardenForChat = (harden: RehypePlugin): RehypePlugin => {
  if (!Array.isArray(harden)) {
    return harden;
  }
  const [plugin, options] = harden;
  return [
    plugin,
    {
      ...(typeof options === "object" ? options : {}),
      imageBlockPolicy: "text-only",
      allowedImagePrefixes: [],
      allowDataImages: false,
      blockedLinkClass: "text-muted-foreground",
    },
  ];
};

// The model never needs raw HTML, so `raw` is left out: an `<img>` or other
// tag in an answer then stays inert text.
const rehypePlugins = Object.entries(defaultRehypePlugins).flatMap(
  ([name, plugin]) => {
    if (name === "raw") {
      return [];
    }
    if (name === "harden") {
      return [hardenForChat(plugin)];
    }
    return [plugin];
  },
);

/**
 * `MessageResponse` turns on Streamdown's Mermaid plugin too; these replace
 * its set. Mermaid stays off because it fetches URLs from a diagram (image
 * labels, image shapes, inline styles) while it renders, even with
 * `securityLevel: "strict"`, which is too late for any sanitizing afterwards.
 * A ```mermaid block then shows as a plain code block.
 */
const streamdownPlugins = { cjk, code, math };

const isToolPart = (
  part: ChatUIMessage["parts"][number],
): part is ChatToolPart =>
  part.type === "tool-searchArticles" || part.type === "tool-getArticle";

const ChatMessage = ({ message }: { message: ChatUIMessage }) => {
  if (message.role === "user") {
    const text = message.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("\n");

    return (
      <Message from="user">
        <MessageContent className="whitespace-pre-wrap">{text}</MessageContent>
      </Message>
    );
  }

  const toolParts = message.parts.filter(isToolPart);

  return (
    <Message from="assistant">
      <MessageContent className="w-full">
        {toolParts.length > 0 && <ToolActivity parts={toolParts} />}
        {message.parts.map((part, index) =>
          part.type === "text" ? (
            <MessageResponse
              key={index}
              className="text-prose"
              components={markdownComponents}
              rehypePlugins={rehypePlugins}
              plugins={streamdownPlugins}
            >
              {part.text}
            </MessageResponse>
          ) : null,
        )}
      </MessageContent>
    </Message>
  );
};

export default ChatMessage;
