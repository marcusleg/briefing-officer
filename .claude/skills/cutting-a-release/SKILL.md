---
name: cutting-a-release
description:
  Use when the user asks to cut, prepare or publish a new Briefing Officer
  release, bump the version, write the changelog or release notes, or tag a
  release after its release PR has been merged.
---

# Cutting a release

## Overview

A release has two phases, separated by the user's review:

1. **Prepare**: write the changelog, bump the version, open a release PR.
2. **Publish**: once the user has merged that PR, tag the merge commit and
   create the GitHub release. The tag triggers the container image and Helm
   chart workflows.

The scripts handle versions, tags and the release itself. Your job is the
changelog: turning a commit list into notes that a person running Briefing
Officer wants to read.

Run the scripts from the repository root with `bash`.

## Phase 1: Prepare

1. Run
   `bash .claude/skills/cutting-a-release/scripts/list-unreleased-commits.sh`.
   It prints the last release, every commit since then with its PR and issue
   numbers, and the next version.
   - If it says `Next version: none`, stop and tell the user there is nothing
     user-facing to release. If they want a release anyway (for example, to ship
     dependency updates), use the next patch version.
2. Read the PRs behind every `feat`, `fix` and `perf` commit and any commit
   marked as breaking:
   `gh pr view <n> --json title,body,closingIssuesReferences`. Read the diff
   when the PR body does not make the user-visible effect clear.
3. Create the branch `chore/release-<version>` from `origin/main`, then run
   `bash .claude/skills/cutting-a-release/scripts/update-version-files.sh <version>`.
4. Write the new section at the top of `CHANGELOG.md`, below `# Changelog`, in
   the format below.
5. Commit `CHANGELOG.md`, `package.json`, `package-lock.json` and
   `helm-chart/Chart.yaml` with the message `chore: release <version>`. The
   `tag-and-publish-release.sh` finds the release commit by this exact message.
6. Push and open a PR titled `chore: release <version>`. Put the new changelog
   section in the PR body.
7. Stop. The user reviews the notes and merges the PR. Do not merge it yourself
   unless the user tells you to (see AGENTS.md).

## Phase 2: Publish

When the user says the release PR is merged, run
`bash .claude/skills/cutting-a-release/scripts/tag-and-publish-release.sh <version>`.
It checks that the release commit is on `main`, tags it `v<version>`, pushes the
tag and creates the GitHub release with that version's changelog section as
notes.

Then check that the container image and Helm chart workflows started:
`gh run list --limit 5`.

## Changelog format

```markdown
## [0.19.0](https://github.com/marcusleg/briefing-officer/compare/v0.18.0...v0.19.0) (2026-10-17)

### ⚠ Breaking Changes

- Renamed `OLD_VAR` to `NEW_VAR`. Rename it in your environment or Helm values
  before upgrading.
  ([#812](https://github.com/marcusleg/briefing-officer/pull/812))

### Features

- Import your feeds from another reader with an OPML file, and export them from
  the user menu.
  ([#770](https://github.com/marcusleg/briefing-officer/pull/770), closes
  [#776](https://github.com/marcusleg/briefing-officer/issues/776))

### Bug Fixes

- …

### Dependencies

- Updated Next.js to 16.4.2.
```

- The heading links to the compare view and ends with today's date.
- Use only the sections that have entries, in this order.
- Each entry is one or two plain sentences about what the user can now do, or
  what no longer goes wrong, followed by links to its PRs and closed issues. A
  commit without a PR gets a link to the commit instead.
- An entry describes the change since the last release. When a feature extends
  one from an earlier release, check that release's section in `CHANGELOG.md`
  and describe only what is new.
- **Breaking Changes** lists anything an operator must act on when upgrading:
  renamed or removed environment variables, changed Helm values, data that will
  be lost. Say what they need to do.
- **Dependencies** has at most one entry. It names upgrades of Next.js, React,
  Prisma, the AI SDK or Node.js with their new versions, in one sentence such as
  "Updated Next.js to 16.4.2 and Prisma to 7.11.0." Leave the section out when
  none of these changed.

## Turning commits into entries

An entry describes a change to the product. A commit describes a step in making
it. These are the rules for getting from one to the other:

| Commits                                                                           | Entry                                                                  |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Several `feat` commits that build one feature (a table, a worker, an API, the UI) | One entry for the feature                                              |
| A `fix` for a bug that the last release does not have                             | No entry; the feature entry already describes the working version      |
| A `fix` for a bug that the last release has                                       | An entry under Bug Fixes, even when it shares a PR with a feature      |
| A `fix` that is a review follow-up ("address review findings")                    | No entry                                                               |
| `refactor`, `test`, `docs`, `ci`, `style`                                         | No entry                                                               |
| `build` or `chore` changing the Helm chart, the Containerfile or required config  | An entry describing what operators notice when they upgrade            |
| Other `build` or `chore`, including dependency bumps                              | No entry; dependency upgrades go in the Dependencies section           |
| A commit adding an environment variable or Helm value                             | Mention the setting by name in the entry for the feature that needs it |

Example. Release 0.16.0 has these commits, among others:

```
feat: add job table for background work
feat: add job repository with retry and backoff
feat: add background worker loop with per-kind concurrency
feat: add scheduler for feed refreshes, lead sweeps, and cleanup
feat: refresh feeds on a schedule without an external cron job
feat: refresh feeds in the background instead of blocking the page
feat: add in-memory per-user event bus
feat: stream change events to open pages
feat: announce new articles instead of inserting them into the open list
fix: address review findings on background jobs and live updates
```

They become two entries:

```markdown
- Feeds now refresh on a schedule in the background, so you no longer need an
  external cron job, and pages no longer wait for a refresh to finish. (…)
- Open pages update when background work finishes. New articles are announced at
  the top of the list instead of moving the list while you read. (…)
```
