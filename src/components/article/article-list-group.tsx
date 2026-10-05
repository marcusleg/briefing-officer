"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";

interface ArticleListGroupContextValue {
  isSelected: (row: string) => boolean;
  select: (row: string) => void;
  /** Re-reads the rows after a list rendered; see `handOff`. */
  sync: () => void;
  /** Every article any list in the group has shown. */
  seenIds: ReadonlySet<number>;
  markSeen: (ids: Iterable<number>) => void;
}

const ArticleListGroupContext =
  createContext<ArticleListGroupContextValue | null>(null);

export const useArticleListGroup = () => useContext(ArticleListGroupContext);

/**
 * A row is one article in one list. The list is part of the key so an
 * article moving into another list (unread to Read Later) counts as leaving
 * its row rather than being followed there.
 */
export const rowKey = (list: string, id: number) => `${list}/${id}`;

/** Marks an element as a row of the group. */
export const rowAttributes = (row: string) => ({ "data-article-row": row });

const rowsIn = (container: HTMLElement | null) =>
  Array.from(
    container?.querySelectorAll<HTMLElement>("[data-article-row]") ?? [],
    (element) => element.dataset.articleRow!,
  );

/**
 * Where the highlight goes when the selected row is gone (the article was
 * marked as read, or moved to another list): to the next row the reader had
 * below it, so "n" carries on from there, or failing that the nearest one
 * above. Rows that arrived since are not candidates, so articles merged in
 * at the top don't take the highlight.
 */
const handOff = (
  rows: string[],
  previous: string[],
  selection: string | undefined,
): string | undefined => {
  if (selection === undefined || rows.includes(selection)) {
    return selection;
  }

  const index = previous.indexOf(selection);
  const below = previous.slice(index + 1);
  const above = previous.slice(0, Math.max(index, 0)).reverse();

  return [...below, ...above].find((row) => rows.includes(row));
};

/**
 * Lets several `ArticleList`s, and whatever sits between them, act as one
 * list: "n" and "p" walk the articles in page order across all of them, and
 * an article moving from one list to another stays shown rather than being
 * held as new.
 *
 * Rows are read from the DOM in document order, so the group needs no
 * knowledge of which lists it holds or how they are laid out.
 */
const ArticleListGroup = ({ children }: { children: ReactNode }) => {
  const container = useRef<HTMLDivElement>(null);
  const previousRows = useRef<string[]>([]);
  const [selection, setSelection] = useState<string>();
  const [seenIds, setSeenIds] = useState<ReadonlySet<number>>(new Set());

  const sync = useCallback(() => {
    const rows = rowsIn(container.current);
    const previous = previousRows.current;
    previousRows.current = rows;
    setSelection((selection) => handOff(rows, previous, selection));
  }, []);

  // The page re-rendered, possibly without any list re-rendering, e.g. when
  // a list that held the selection was removed altogether.
  useLayoutEffect(sync);

  const markSeen = useCallback((ids: Iterable<number>) => {
    setSeenIds((seen) => {
      const added = [...ids].filter((id) => !seen.has(id));
      return added.length > 0 ? new Set([...seen, ...added]) : seen;
    });
  }, []);

  useHotkeys("n", () => {
    const rows = rowsIn(container.current);
    const index = selection === undefined ? -1 : rows.indexOf(selection);

    if (index < rows.length - 1) {
      setSelection(rows[index + 1]);
    }
  });

  useHotkeys("p", () => {
    const rows = rowsIn(container.current);
    const index = selection === undefined ? -1 : rows.indexOf(selection);

    if (index !== -1) {
      setSelection(rows[index - 1]);
    }
  });

  const value = useMemo(
    () => ({
      isSelected: (row: string) => row === selection,
      select: setSelection,
      sync,
      seenIds,
      markSeen,
    }),
    [selection, sync, seenIds, markSeen],
  );

  return (
    <ArticleListGroupContext.Provider value={value}>
      {/* `contents` keeps the lists laid out as children of the page. */}
      <div className="contents" ref={container}>
        {children}
      </div>
    </ArticleListGroupContext.Provider>
  );
};

export default ArticleListGroup;
