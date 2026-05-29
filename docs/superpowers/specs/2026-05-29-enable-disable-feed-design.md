# Enable/Disable Feed — Design

## Summary

Let users pause a feed so it stops fetching new articles automatically, without
deleting it. A paused feed stays visible in the sidebar, shown greyed out with a
pause icon, and its existing articles remain readable. Users toggle the state
through an "Enabled" switch in the Edit Feed dialog. Manual per-feed refresh
still works as a deliberate override even while a feed is paused.

The `Feed` model already carries the field:

```prisma
enabled Boolean @default(true)
```

This design wires that field into the migration, refresh logic, form, and
sidebar.

## Behavior

- **Disabling pauses automatic fetching.** Disabled feeds are skipped by the
  cron job (`refreshFeeds`), "refresh all", and category refresh
  (`refreshCategoryFeeds`).
- **Manual per-feed refresh is an override.** `refreshFeed(feedId)` ignores the
  `enabled` flag, so an explicit refresh on a paused feed still fetches.
- **Disabled feeds stay visible.** They remain in the sidebar, shown with muted
  title text and a pause icon. The unread badge is unchanged.
- **New feeds default to enabled.** The form switch defaults to on, matching the
  DB default.

## Components

### 1. Data & Migration

- The `enabled Boolean @default(true)` field already exists on `Feed` in
  `prisma/schema.prisma`.
- Generate a Prisma migration to match it:
  `prisma migrate dev --name add_enabled_field_to_feed`.
- `@default(true)` means all existing feeds remain enabled. No data backfill
  required.

### 2. Backend (`src/lib/repository/feedRepository.ts`)

- `refreshFeeds()` — add `enabled: true` to the `findMany` `where` clause.
- `refreshCategoryFeeds()` — add `enabled: true` to its `findMany` `where`
  clause.
- `refreshFeed(feedId)` — unchanged, preserving the manual override.

### 3. Form validation & persistence

- `src/lib/repository/feedSchema.ts` — add `enabled: z.boolean()` to
  `feedSchema`.
- `createFeed` and `updateFeed` already spread `...feed` into Prisma, so once
  `enabled` is part of the schema and form values it persists with no further
  change.

### 4. UI — Enabled switch

- Add `src/components/ui/switch.tsx` — the standard shadcn Switch wrapper around
  the already-installed `@radix-ui/react-switch` primitive.
- In `src/components/feed/feed-form.tsx`, add an `enabled` `FormField` using the
  existing `FormItem` / `FormLabel` / `FormControl` pattern and the `Switch`
  component:
  - `defaultValues`: `editFeed?.enabled ?? true`.
  - Label "Enabled" with helper text: "Paused feeds are skipped during automatic
    refresh."
  - Honor the existing `disabled={submitting}` pattern.
- The same form renders inside the Add Feed dialog, where the switch defaults to
  on — consistent and expected.

### 5. Sidebar indicator (`src/components/navigation/feed-navigation.tsx`)

- The existing queries use `include`, so the `enabled` scalar is already
  returned. No query change needed.
- In the `menuItems` renderer, when `feed.enabled === false`:
  - Render a lucide `PauseIcon` instead of `NewspaperIcon`.
  - Apply muted styling to the title span (e.g. `text-muted-foreground`).
  - Keep the unread badge as-is.

## Out of Scope (YAGNI)

- Quick toggle button on the feed page (toggle lives only in the Edit dialog).
- Hiding disabled feeds from the sidebar (they stay visible, greyed).
- A status enum for feeds — the boolean covers the requirement.

## Testing

- **Backend:** disabling a feed causes `refreshFeeds` and `refreshCategoryFeeds`
  to skip it; `refreshFeed` on the same feed still fetches.
- **Form:** the Edit dialog reflects the current `enabled` state; toggling and
  saving persists it; new feeds default to enabled.
- **Sidebar:** a disabled feed renders with the pause icon and muted title; an
  enabled feed is unchanged.
