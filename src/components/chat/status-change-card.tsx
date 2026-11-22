"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ChatStatusTarget } from "@/lib/ai/chat/articleTools";
import type { ChatUIMessage } from "@/lib/ai/chat/tools";
import {
  getArticlesForStatusChange,
  type StatusChangeArticles,
} from "@/lib/repository/chatRepository";
import { useEffect, useState } from "react";

export type StatusChangePart = Extract<
  ChatUIMessage["parts"][number],
  { type: "tool-setArticleStatus" }
>;

export type ApprovalResponse = { id: string; approved: boolean };

const LIST_PREVIEW = 10;

const articles = (count: number) =>
  count === 1 ? "1 article" : `${count} articles`;

const wording: Record<
  ChatStatusTarget,
  {
    propose: (n: number) => string;
    already: string;
    applied: (n: number) => string;
    declined: (n: number) => string;
  }
> = {
  READ: {
    propose: (n) => `Mark ${articles(n)} as read?`,
    already: "already read",
    applied: (n) => `Marked ${articles(n)} as read`,
    declined: (n) => `You declined: mark ${articles(n)} as read`,
  },
  UNREAD: {
    propose: (n) => `Mark ${articles(n)} as unread?`,
    already: "already unread",
    applied: (n) => `Marked ${articles(n)} as unread`,
    declined: (n) => `You declined: mark ${articles(n)} as unread`,
  },
  READ_LATER: {
    propose: (n) => `Save ${articles(n)} for later?`,
    already: "already saved for later",
    applied: (n) => `Saved ${articles(n)} for later`,
    declined: (n) => `You declined: save ${articles(n)} for later`,
  },
};

type Lookup =
  | { state: "loading" }
  | { state: "loaded"; result: StatusChangeArticles }
  | { state: "failed" };

const ArticleList = ({
  items,
}: {
  items: StatusChangeArticles["articles"];
}) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, LIST_PREVIEW);
  const hidden = items.length - shown.length;

  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-1">
        {shown.map((item) => (
          <li key={item.id} className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{item.title}</span>
            <span className="text-muted-foreground text-xs">
              {`${item.feed} · ${item.published}`}
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <Button
          variant="link"
          size="sm"
          className="self-start px-0"
          onClick={() => setExpanded(true)}
        >
          Show {hidden} more
        </Button>
      )}
    </div>
  );
};

/**
 * Asks the reader to approve a status change the assistant proposed, then
 * reports how it went. The list comes from the server for the ids the tool
 * will change; the model's own text never names what the card shows.
 */
const StatusChangeCard = ({
  part,
  interrupted = false,
  otherPending = false,
  onRespond,
}: {
  part: StatusChangePart;
  /**
   * The conversation moved on, or the request for this answer failed: an
   * approved change that has not run by now never will.
   */
  interrupted?: boolean;
  /** Another change in the same answer still waits for the reader. */
  otherPending?: boolean;
  onRespond: (response: ApprovalResponse) => void;
}) => {
  const ids = part.state === "input-streaming" ? undefined : part.input?.ids;
  const status = part.input?.status;
  const [lookup, setLookup] = useState<Lookup>({ state: "loading" });
  const [listOpen, setListOpen] = useState(false);

  // Loaded once per tool call; the card keeps the list for its later states.
  const idsKey = ids?.join(",");
  useEffect(() => {
    if (!idsKey) {
      return;
    }
    let cancelled = false;
    getArticlesForStatusChange(idsKey.split(",").map(Number)).then(
      (result) => !cancelled && setLookup({ state: "loaded", result }),
      () => !cancelled && setLookup({ state: "failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  if (!ids || !status) {
    return (
      <Surface>
        <Line spinner>Preparing a change…</Line>
      </Surface>
    );
  }

  const words = wording[status];
  const loaded = lookup.state === "loaded" ? lookup.result : undefined;
  const already =
    loaded?.articles.filter((item) => item.status === status).length ?? 0;
  const toChange = loaded ? loaded.articles.length - already : ids.length;
  const nothingFound = loaded !== undefined && loaded.articles.length === 0;
  const nothingToChange = (
    <Line>
      {nothingFound
        ? "None of these articles were found"
        : `These articles are ${words.already}`}
    </Line>
  );
  const changing = loaded?.articles.filter((item) => item.status !== status);
  const declined =
    part.state === "output-denied" ||
    (part.state === "approval-responded" && part.approval.approved === false);

  if (declined) {
    return (
      <Surface>
        {loaded && toChange === 0 ? (
          nothingToChange
        ) : (
          <Line>{words.declined(toChange)}</Line>
        )}
      </Surface>
    );
  }

  if (part.state === "output-error") {
    return (
      <Surface>
        <Line>Couldn&apos;t update the articles.</Line>
      </Surface>
    );
  }

  if (part.state === "output-available") {
    const output = part.output;
    if ("error" in output) {
      return (
        <Surface>
          <Line>Couldn&apos;t update the articles.</Line>
        </Surface>
      );
    }
    return (
      <Surface>
        <Line>
          {output.changed > 0
            ? words.applied(output.changed)
            : `These articles are ${words.already}`}
        </Line>
        {loaded && loaded.articles.length > 0 && (
          <>
            <Button
              variant="link"
              size="sm"
              className="self-start px-0"
              onClick={() => setListOpen((open) => !open)}
            >
              {listOpen ? "Hide articles" : "Show articles"}
            </Button>
            {listOpen && <ArticleList items={loaded.articles} />}
          </>
        )}
      </Surface>
    );
  }

  if (part.state === "approval-responded") {
    if (interrupted) {
      return (
        <Surface>
          <Line>Couldn&apos;t update the articles.</Line>
        </Surface>
      );
    }
    // The SDK sends approvals once every card in the answer is answered.
    return (
      <Surface>
        <Line>{words.propose(toChange)}</Line>
        {changing && <ArticleList items={changing} />}
        {otherPending ? (
          <p className="text-muted-foreground">
            Applies once you answer the other proposal.
          </p>
        ) : (
          <Line spinner>Applying…</Line>
        )}
      </Surface>
    );
  }

  if (part.state !== "approval-requested") {
    // input-available: the server is about to ask for approval.
    return (
      <Surface>
        <Line spinner>Preparing a change…</Line>
      </Surface>
    );
  }

  const approvalId = part.approval.id;
  const decline = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onRespond({ id: approvalId, approved: false })}
    >
      Decline
    </Button>
  );

  if (lookup.state === "failed") {
    return (
      <Surface>
        <Line>Couldn&apos;t load these articles.</Line>
        <Actions>{decline}</Actions>
      </Surface>
    );
  }

  if (!loaded) {
    return (
      <Surface>
        <Line spinner>Loading the articles…</Line>
        <Actions>
          <Button size="sm" disabled>
            Apply
          </Button>
          <Button variant="outline" size="sm" disabled>
            Decline
          </Button>
        </Actions>
      </Surface>
    );
  }

  if (toChange === 0) {
    return (
      <Surface>
        {nothingToChange}
        <Actions>{decline}</Actions>
      </Surface>
    );
  }

  return (
    <Surface>
      <Line>{words.propose(toChange)}</Line>
      <ArticleList items={changing ?? []} />
      {already > 0 && (
        <p className="text-muted-foreground">
          {already} {words.already}
        </p>
      )}
      {loaded.notFound > 0 && (
        <p className="text-muted-foreground">
          {articles(loaded.notFound)} not found
        </p>
      )}
      <Actions>
        <Button
          size="sm"
          onClick={() => onRespond({ id: approvalId, approved: true })}
        >
          Apply
        </Button>
        {decline}
      </Actions>
    </Surface>
  );
};

const Surface = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-muted flex flex-col gap-2 rounded-lg border p-3 text-sm">
    {children}
  </div>
);

const Line = ({
  children,
  spinner = false,
}: {
  children: React.ReactNode;
  spinner?: boolean;
}) => (
  <p className="flex items-center gap-2 font-medium">
    {spinner && <Spinner />}
    {children}
  </p>
);

const Actions = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2">{children}</div>
);

export default StatusChangeCard;
