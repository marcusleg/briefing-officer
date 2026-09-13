"use server";

import { DEFAULT_DISINTERESTS } from "@/lib/feedFilters";
import logger from "@/lib/logger";
import {
  buildOpml,
  InvalidOpmlError,
  isHttpUrl,
  OpmlExportFeed,
  OpmlImportResult,
  ParsedOpml,
  parseOpml,
} from "@/lib/opml";
import prisma from "@/lib/prismaClient";
import { refreshFeed } from "@/lib/repository/feedRepository";
import { getUserId } from "@/lib/repository/userRepository";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

const EXPORT_TITLE = "Briefing Officer feeds";

const readUpload = async (formData: FormData): Promise<string | null> => {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }
  return file.text();
};

/**
 * Inserts feed rows the way createFeed leaves them — lastFetched at epoch,
 * auto refresh on, default disinterests seeded — but does not fetch anything
 * first. A file may list a hundred feeds, and fetching each one before the
 * dialog can close would take minutes. Refreshes run after the response
 * instead; a URL that turns out not to be a feed logs an error on refresh and
 * sits empty, the same as a feed that dies after subscription does today.
 */
export const importOpml = async (
  formData: FormData,
): Promise<OpmlImportResult> => {
  const text = await readUpload(formData);
  if (text === null) {
    return { ok: false, error: "Choose an OPML file to import." };
  }

  let entries: ParsedOpml["entries"];
  try {
    ({ entries } = parseOpml(text));
  } catch (error) {
    if (error instanceof InvalidOpmlError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  const userId = await getUserId();

  const [categories, feeds] = await Promise.all([
    prisma.feedCategory.findMany({
      where: { userId },
      select: { id: true, name: true },
    }),
    prisma.feed.findMany({ where: { userId }, select: { link: true } }),
  ]);

  // The schema forbids the same link twice per user, and the file is not a
  // source of truth for feeds the reader has already configured — a match is
  // skipped whole, title and category included. Adding to the set as we go
  // also folds a URL listed twice in one file into a single import.
  const subscribed = new Set(feeds.map((feed) => feed.link));
  const unusable: string[] = [];
  let skipped = 0;
  const toCreate = entries.filter((entry) => {
    if (!isHttpUrl(entry.xmlUrl)) {
      unusable.push(entry.title);
      return false;
    }
    if (subscribed.has(entry.xmlUrl)) {
      skipped += 1;
      return false;
    }
    subscribed.add(entry.xmlUrl);
    return true;
  });

  // Matched case-insensitively so a file that says "tech" does not put a
  // second category beside an existing "Tech".
  const categoryIdsByName = new Map(
    categories.map((category) => [category.name.toLowerCase(), category.id]),
  );

  const { createdFeedIds, categoriesCreated } = await prisma.$transaction(
    async (tx) => {
      const createdFeedIds: number[] = [];
      let categoriesCreated = 0;

      for (const entry of toCreate) {
        let feedCategoryId: number | null = null;

        if (entry.category !== null) {
          const key = entry.category.toLowerCase();
          let categoryId = categoryIdsByName.get(key);
          if (categoryId === undefined) {
            const created = await tx.feedCategory.create({
              data: { userId, name: entry.category },
            });
            categoryId = created.id;
            categoryIdsByName.set(key, categoryId);
            categoriesCreated += 1;
          }
          feedCategoryId = categoryId;
        }

        const feed = await tx.feed.create({
          data: {
            title: entry.title,
            link: entry.xmlUrl,
            autoRefresh: true,
            lastFetched: new Date(0),
            userId,
            feedCategoryId,
            filters: {
              create: DEFAULT_DISINTERESTS.map((text) => ({
                kind: "DISINTEREST" as const,
                text,
              })),
            },
          },
        });
        createdFeedIds.push(feed.id);
      }

      return { createdFeedIds, categoriesCreated };
    },
  );

  revalidatePath("/feed", "layout");

  if (createdFeedIds.length > 0) {
    after(() =>
      Promise.all(
        createdFeedIds.map((feedId) =>
          refreshFeed(feedId).catch((error) =>
            logger.error(
              { err: error, feedId },
              "Failed to refresh a feed imported from OPML.",
            ),
          ),
        ),
      ),
    );
  }

  logger.info(
    {
      imported: createdFeedIds.length,
      skipped,
      categoriesCreated,
      unusable: unusable.length,
    },
    "Imported feeds from OPML.",
  );

  return {
    ok: true,
    imported: createdFeedIds.length,
    skipped,
    categoriesCreated,
    unusable,
  };
};

export const exportOpml = async (): Promise<string> => {
  const userId = await getUserId();

  const feeds = await prisma.feed.findMany({
    where: { userId },
    select: {
      title: true,
      link: true,
      FeedCategory: { select: { name: true } },
    },
  });

  const feedsByCategory = new Map<string | null, OpmlExportFeed[]>();
  for (const feed of feeds) {
    const name = feed.FeedCategory?.name ?? null;
    const group = feedsByCategory.get(name) ?? [];
    group.push({ title: feed.title, xmlUrl: feed.link });
    feedsByCategory.set(name, group);
  }

  return buildOpml(
    EXPORT_TITLE,
    [...feedsByCategory].map(([name, group]) => ({ name, feeds: group })),
  );
};
