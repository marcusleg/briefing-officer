# OPML Import and Export — Design

Date: 2026-09-13

## Summary

Let a reader move their feed list in and out of Briefing Officer as an OPML
file, the interchange format every feed reader speaks. Export writes the
reader's feeds, grouped by category, to a file the browser downloads. Import
reads such a file, creates the categories it names, subscribes to the feeds it
lists, skips the ones the reader already has, and reports what it did.

Both live in the sidebar next to "Add Feed", because that is where the reader
manages subscriptions today. Neither needs a schema change.

## Motivation

The PRD lists OPML as the one known gap that "is a common expectation for a feed
reader". A reader arriving from another reader has to re-enter tens of feeds by
hand, and a reader leaving has no way to take their list with them. Both are the
kind of friction that decides whether a self-hosted tool gets adopted at all.

## Goals

- Export the reader's feeds as a valid OPML 2.0 file, one nested outline per
  category, that other readers accept.
- Import an OPML file from any common reader: flat lists, one level of folders,
  and deeper nesting all work.
- Importing is idempotent. Running the same file twice subscribes to nothing new
  the second time.
- The reader sees a summary of what happened: feeds added, feeds skipped because
  they were already subscribed, and entries that could not be used.
- Everything is scoped to the signed-in user, like every other piece of data.

## Non-goals

- **Round-tripping filter keywords, pause state, or article state.** OPML has no
  standard place for them, and no other reader would read them. A reader moving
  between two Briefing Officer instances loses their keyword lists. This is a
  plausible follow-up using namespaced attributes, deferred until someone
  actually asks for it.
- **Fetching each feed during import to validate it or detect its title.**
  Import of a hundred feeds must not make a hundred network calls before the
  dialog can close. Titles come from the file; validation comes from the first
  refresh, the same way a feed that later goes dead is handled today.
- **Merging or replacing categories on import.** Import only adds. Deleting or
  reorganising stays a manual job in the UI.
- **Importing from a URL.** File upload only.
- **A feed-management settings page.** Two sidebar entries are enough.

## Decisions and their alternatives

### Export is a route handler; import is a server action

Export returns a file the browser must download, so it needs a real HTTP
response with `Content-Disposition`. That is a route handler at `/api/opml`,
authenticated by the same session lookup the rest of the app uses. A plain
anchor in the sidebar points at it; no client state is involved.

Import takes an uploaded file and changes data, which is what server actions are
for. The action receives `FormData`, reads the file as text, and returns a
summary object the dialog renders. The alternative, a `POST` route handler with
a fetch from the client, would need its own error and loading handling that the
form and action pattern already provides.

### Feeds are created directly, then refreshed in the background

`createFeed` fetches the feed to verify it parses, then awaits a full refresh
including scraping and AI lead generation for every new article. For one feed
that is acceptable; for fifty it would hold the dialog open for many minutes and
likely exceed the action's timeout. Import therefore inserts feed rows with
`lastFetched` at epoch and the default disinterests seeded, exactly as
`createFeed` would leave them, then starts a refresh of the imported feeds
without awaiting it, the way the cron endpoint already does. The sidebar shows
the new feeds immediately and their articles arrive as refreshes finish. A feed
whose URL turns out not to be a feed logs an error on refresh and sits empty,
which is the same failure mode a feed that dies after subscription has today.

The alternative of leaving new feeds for the next cron run was rejected: a
reader who has just imported wants to see something happen, and cron may be
fifteen minutes away.

### Categories are matched by name, nearest folder wins

An outline with an `xmlUrl` is a feed. The nearest enclosing outline without one
is its category, named by that outline's `text` (or `title`) attribute. Deeper
nesting is flattened to the innermost folder, since the application has one
level of categories and the innermost name is the most specific. A feed at the
top level of the body is uncategorised.

Category names are matched case-insensitively against the reader's existing
categories, so importing into an instance that already has "Tech" does not
create "tech" beside it. A category that matches nothing is created. Empty
folders in the file are not created; a category with no feeds is noise.

### Duplicates are skipped by URL, not merged

The schema already forbids the same `link` twice for one user. An entry whose
`xmlUrl` the reader already subscribes to is counted as skipped and left exactly
as it is, including its title, category, and filters. The file is not a source
of truth for feeds the reader has already configured. The same URL listed twice
in one file is imported once.

### Entries that cannot be used are reported, not fatal

An outline with an `xmlUrl` that is not an absolute `http` or `https` URL is
counted under "could not be imported" with its text, and the rest of the file
still imports. A file that does not parse as OPML at all, meaning no `<opml>`
root with a `<body>`, is rejected with one message and nothing is written.

### Titles come from the file, with a fallback

The feed title is the outline's `title` attribute, then `text`, then the URL
itself. Other readers write `text` and `title` with the same value; some write
only `text`. A title is never left empty because the sidebar shows it.

## Components

### `src/lib/opml.ts` — pure parsing and serialising

Not a `"use server"` module, so it can export types and synchronous functions
and be unit tested without a database.

```ts
export interface OpmlFeedEntry {
  title: string;
  xmlUrl: string;
  category: string | null;
}

export interface ParsedOpml {
  entries: OpmlFeedEntry[];
}

/** Throws `InvalidOpmlError` when the text is not an OPML document. */
export const parseOpml = (text: string): ParsedOpml;

export interface OpmlExportCategory {
  name: string | null; // null = uncategorised, emitted at body level
  feeds: { title: string; xmlUrl: string }[];
}

export const buildOpml = (
  title: string,
  categories: OpmlExportCategory[],
): string;
```

Parsing uses `htmlparser2`'s `parseDocument` in XML mode, which the scraper
already uses. Serialising writes the string by hand with an XML attribute
escaper; the output is small and regular enough that a builder library is not
worth a dependency.

Export output shape:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Briefing Officer feeds</title>
    <dateCreated>Sat, 13 Sep 2026 10:00:00 GMT</dateCreated>
  </head>
  <body>
    <outline text="Uncategorised feed" title="Uncategorised feed" type="rss" xmlUrl="https://…"/>
    <outline text="Tech" title="Tech">
      <outline text="A feed" title="A feed" type="rss" xmlUrl="https://…"/>
    </outline>
  </body>
</opml>
```

Uncategorised feeds are emitted before categories. Within a group, feeds are
sorted by title; categories are sorted by name, matching the sidebar.

### `src/lib/repository/opmlRepository.ts` — server actions

```ts
export interface OpmlImportResult {
  imported: number;
  skipped: number; // already subscribed, or duplicated within the file
  categoriesCreated: number;
  unusable: string[]; // titles or URLs of entries that could not be used
}

export const importOpml = async (formData: FormData): Promise<OpmlImportResult>;
export const exportOpml = async (): Promise<string>;
```

`importOpml`:

1. Reads the `file` field, rejects a missing file, and reads it as text.
2. Calls `parseOpml`. An `InvalidOpmlError` is rethrown with a reader-facing
   message; the dialog shows it.
3. Loads the user's categories and feed links.
4. In one transaction, creates missing categories and inserts feed rows plus
   default disinterest filters for every usable, not-yet-subscribed entry.
5. Calls `revalidatePath("/feed", "layout")`.
6. Starts `refreshFeed` for each created feed, not awaited, with failures
   logged. Refreshes run concurrently, the same as `refreshFeeds` does.
7. Returns the summary.

`exportOpml` loads the user's feeds with their categories and calls `buildOpml`.

### `src/app/api/opml/route.ts` — export download

`GET` resolves the user via `getUserId`, which throws when there is no session;
the handler turns that into a 401. On success it returns the OPML text with
`Content-Type: text/x-opml; charset=utf-8` and
`Content-Disposition: attachment; filename="briefing-officer.opml"`.

### `src/components/navigation/import-opml-dialog-trigger.tsx`

A dialog matching the "Add Feed" one. Contains a file input accepting
`.opml,.xml,text/xml,application/xml,text/x-opml`, an Import button that is
disabled until a file is chosen and shows a spinner while the action runs, and
after completion a summary in place of the form: "Imported 12 feeds. Skipped 3
you already had. 2 categories created." followed by a list of unusable entries
when there are any. A failed parse shows the error message in the same place
with the form still available. Closing the dialog resets it.

### `src/components/navigation/add-nav-actions.tsx`

Gains two sidebar items after "Add Feed": "Import OPML" (opens the dialog) and
"Export OPML" (an anchor to `/api/opml` with the `download` attribute).

## Error handling

- No session on the export route: 401 with an empty body.
- No file or an empty file on import: the action throws "Choose an OPML file to
  import."; the dialog shows it.
- Not OPML: "This file is not an OPML document."; nothing is written.
- Individual bad entries: reported in `unusable`, the rest imports.
- Database failure mid-import: the transaction rolls back, the action throws,
  the dialog shows a generic failure message.
- Refresh failures after import: logged, not surfaced. The feed exists and the
  reader can refresh it by hand from its page.

## Testing

- **Unit, `tests/unit/opml.test.ts`:** `parseOpml` on a flat file, one level of
  folders, nested folders (innermost wins), missing `title` falling back to
  `text`, entries without `xmlUrl` ignored as folders, non-OPML input throwing,
  attribute entities decoded. `buildOpml` produces the shape above, escapes `&`,
  `<`, and `"` in titles and URLs, and sorts as specified.
- **Integration, `tests/integration/opmlRepository.test.ts`:** with the scraper
  and lead service mocked as in the feed repository tests. Import creates feeds
  and categories; matches an existing category case-insensitively; skips an
  already-subscribed URL and counts it; imports a URL listed twice once; seeds
  default disinterests; does not touch another user's feeds; rejects non-OPML
  with nothing written; triggers `scrapeFeed` for each new feed. Export groups
  by category, emits uncategorised feeds at body level, and excludes other
  users' feeds.
- **Component, `tests/components/navigation/import-opml-dialog.test.tsx`:** the
  Import button is disabled without a file, the summary renders from a mocked
  action result, and an action error is shown.

## Documentation

- `docs/prd.md`: remove the non-goal and the open gap; add OPML import and
  export to the feed reading feature and to the "Adding a feed" flow.
- `README.md`: one line under features.
