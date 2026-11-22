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
import { createContext, useContext, type ComponentProps } from "react";
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
 * What a caller decides about a link the model wrote, given its href: a URL
 * to open instead, in a new tab; `null` to show the link's text without a
 * link; or `undefined` to keep the link as it is. A URL returned here is not
 * checked again, so it must come from the app, never from the model.
 */
export type NewTabHref = (href: string) => string | null | undefined;

/**
 * Set by `SafeMarkdown`. A context rather than a prop of the link component:
 * `MessageResponse` re-renders only when the Markdown changes, and a context
 * still reaches the links when this does.
 */
const NewTabHrefContext = createContext<NewTabHref | undefined>(undefined);

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
};

/**
 * Links to the reader's own articles and footnotes stay in the tab; anything
 * else, such as a source, opens in a new one. `NewTabHref` can send a link
 * elsewhere, which then names the site it opens, or turn it into text.
 * Streamdown adds `target` and `rel` to every link and passes its syntax tree
 * node, so in-tab links drop the former and nothing passes the node on to the
 * DOM. The model picks the paths, so they are not prefetched before a click.
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
  const newTabHref = useContext(NewTabHrefContext);
  const linkClassName = cn(
    "text-primary hover:text-hover underline underline-offset-2",
    className,
  );
  const newTab = href === undefined ? undefined : newTabHref?.(href);

  if (newTab === null) {
    return <span>{children}</span>;
  }

  if (isInApp(href) && newTab === undefined) {
    return (
      <Link href={href} prefetch={false} {...props} className={linkClassName}>
        {children}
      </Link>
    );
  }

  const host = newTab === undefined ? undefined : hostOf(newTab);
  const link = (
    <a
      href={newTab ?? href}
      {...props}
      className={linkClassName}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );

  return host ? (
    <>
      {link} <span className="text-muted-foreground text-sm">({host})</span>
    </>
  ) : (
    link
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
  /** What becomes of each link the model wrote; see `NewTabHref`. */
  newTabHref?: NewTabHref;
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
  newTabHref,
}: SafeMarkdownProps) => (
  <NewTabHrefContext value={newTabHref}>
    <MessageResponse
      className={className}
      isAnimating={isAnimating}
      components={{ ...components, a: SafeLink, img: AltTextImage }}
      rehypePlugins={rehypePlugins}
      plugins={streamdownPlugins}
    >
      {children}
    </MessageResponse>
  </NewTabHrefContext>
);
