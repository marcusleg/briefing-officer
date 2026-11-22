-- The READ status is now called DISMISSED: the reader is done with the article,
-- whether they read it or the lead was enough.
UPDATE "Article" SET "status" = 'DISMISSED' WHERE "status" = 'READ';
