-- Write the reason before the status that identifies these rows is
-- overwritten; afterwards they can no longer be found.
UPDATE "Article"
SET "filterReason" = 'You marked this as not interested.'
WHERE "status" = 'NOT_INTERESTED' AND "filterReason" IS NULL;

UPDATE "Article"
SET "status" = 'FILTERED'
WHERE "status" = 'NOT_INTERESTED';
