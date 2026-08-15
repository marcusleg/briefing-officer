-- Backfill for feeds that predate FeedFilter: they were dropped straight
-- from a free-text interestProfile to zero FeedFilter rows, which silently
-- turns filtering off for them forever. This seeds the same two DISINTEREST
-- defaults that createFeed seeds for new feeds ("advertisements",
-- "sponsored posts", see DEFAULT_DISINTERESTS in src/lib/feedFilters.ts)
-- onto every existing feed.
--
-- Guarded by NOT EXISTS per row so this is safe to re-run and cannot collide
-- with the @@unique([feedId, kind, text]) constraint — a feed that already
-- has either row (e.g. seeded by a later `prisma db push`/create, or by a
-- prior run of this migration) is skipped for that row only.
INSERT INTO "FeedFilter" ("feedId", "kind", "text", "createdAt")
SELECT f."id", 'DISINTEREST', d."text", CURRENT_TIMESTAMP
FROM "Feed" f
CROSS JOIN (
  SELECT 'advertisements' AS "text"
  UNION ALL
  SELECT 'sponsored posts'
) d
WHERE NOT EXISTS (
  SELECT 1
  FROM "FeedFilter" ff
  WHERE ff."feedId" = f."id"
    AND ff."kind" = 'DISINTEREST'
    AND ff."text" = d."text"
);
