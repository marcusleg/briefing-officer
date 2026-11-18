"use client";

import {
  MessageResponse,
  type MessageResponseProps,
} from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import "katex/dist/katex.min.css";
import Link from "next/link";
import type { ComponentProps } from "react";
import {
  defaultRehypePlugins,
  type Components,
  type ExtraProps,
} from "streamdown";

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
const SafeLink = ({
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
 * Model output never loads images. A hostile article can tell the model to put
 * reader data in an image URL, which the browser would fetch unasked, so an
 * image only ever shows its alt text.
 */
const AltTextImage = ({ alt }: ComponentProps<"img"> & ExtraProps) =>
  alt ? <>{alt}</> : null;

type RehypePlugin = (typeof defaultRehypePlugins)[string];

/**
 * A blocked link stays as text marked "[blocked]", colored with a design token
 * instead of the plugin's default gray. No image prefix is allowed and data
 * images are off, so the plugin blocks every image as well, and the blocked
 * image shows only its alt text, like `AltTextImage`, instead of a gray
 * "[Image blocked]" badge. `AltTextImage` is the second guard.
 */
const hardenLinksAndImages = (harden: RehypePlugin): RehypePlugin => {
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
// tag in its output then stays inert text.
const rehypePlugins = Object.entries(defaultRehypePlugins).flatMap(
  ([name, plugin]) => {
    if (name === "raw") {
      return [];
    }
    if (name === "harden") {
      return [hardenLinksAndImages(plugin)];
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

/**
 * Only these props reach Streamdown. Its other props, such as
 * `BlockComponent`, `remarkPlugins` or `urlTransform`, could rebuild the
 * rendering pipeline around the guards here.
 */
export type SafeMarkdownProps = Pick<
  MessageResponseProps,
  "children" | "className" | "isAnimating"
> & {
  components?: Omit<Components, "a" | "img">;
};

/**
 * Renders model-written Markdown, which may follow instructions planted in a
 * scraped article. Raw HTML stays text, images show only their alt text, and
 * links go through `SafeLink`; `components` can style other elements but not
 * replace links or images.
 */
export const SafeMarkdown = ({
  children,
  className,
  isAnimating,
  components,
}: SafeMarkdownProps) => (
  <MessageResponse
    className={className}
    isAnimating={isAnimating}
    components={{ ...components, a: SafeLink, img: AltTextImage }}
    rehypePlugins={rehypePlugins}
    plugins={streamdownPlugins}
  >
    {children}
  </MessageResponse>
);
