"use client";

import { ArticleStatus } from "@/generated/prisma/client";
import {
  createContext,
  ReactNode,
  startTransition,
  useCallback,
  useContext,
  useMemo,
  useOptimistic,
} from "react";
import { toast } from "sonner";

/** The fields a reader's own actions change on an article. */
export interface ArticleOverride {
  status?: ArticleStatus;
  starred?: boolean;
}

type Overrides = ReadonlyMap<number, ArticleOverride>;

interface OverrideUpdate {
  articleId: number;
  override: ArticleOverride;
}

const NO_OVERRIDES: Overrides = new Map();

interface ArticleOverridesContextValue {
  overrides: Overrides;
  addOverride: (update: OverrideUpdate) => void;
}

const ArticleOverridesContext = createContext<ArticleOverridesContextValue>({
  overrides: NO_OVERRIDES,
  addOverride: () => {},
});

/**
 * Changes the reader has made that the server has not confirmed yet, by
 * article id.
 *
 * Each change is an optimistic update held for as long as its server action is
 * in flight. With `experimental.useOffline`, an action sent without a
 * connection stays in flight until the connection returns, so the change stays
 * on screen for the whole time the reader is offline. Once the action settles
 * the override falls away: on success the revalidated server data already says
 * the same thing; on failure the article reverts.
 *
 * It lives in the feed layout rather than in a list so it outlives navigation:
 * an article dismissed from its summary page must not reappear in the inbox
 * the reader goes back to, whose cached data predates the dismissal.
 */
export const ArticleOverridesProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [overrides, addOverride] = useOptimistic(
    NO_OVERRIDES,
    (current: Overrides, { articleId, override }: OverrideUpdate) =>
      new Map(current).set(articleId, {
        ...current.get(articleId),
        ...override,
      }),
  );

  const value = useMemo(
    () => ({ overrides, addOverride }),
    [overrides, addOverride],
  );

  return (
    <ArticleOverridesContext.Provider value={value}>
      {children}
    </ArticleOverridesContext.Provider>
  );
};

/** Returns a function that lays the pending changes over an article. */
export const useWithOverrides = () => {
  const { overrides } = useContext(ArticleOverridesContext);

  return useCallback(
    <T extends { id: number } & ArticleOverride>(article: T): T => {
      const override = overrides.get(article.id);
      return override ? { ...article, ...override } : article;
    },
    [overrides],
  );
};

/**
 * Returns a function that shows a change at once and saves it in the
 * background. The caller never waits: offline, the save does not settle until
 * the connection returns, and nothing on screen should wait for that.
 */
export const useArticleChange = () => {
  const { addOverride } = useContext(ArticleOverridesContext);

  return useCallback(
    (
      article: { id: number; title: string },
      override: ArticleOverride,
      save: () => Promise<unknown>,
    ) => {
      startTransition(async () => {
        addOverride({ articleId: article.id, override });

        try {
          await save();
        } catch {
          toast.error("Couldn't save your change", {
            description: <span className="italic">{article.title}</span>,
          });
        }
      });
    },
    [addOverride],
  );
};
