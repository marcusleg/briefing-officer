# AGENTS.md

## Workflow

Get the user's approval before making any of these hard-to-undo changes:

- database schema changes and migrations
- API changes: HTTP routes, request or response shapes, anything outside
  clients rely on
- configuration operators set: environment variables, Helm values
- anything that deletes or rewrites existing user data

When the work is done, open a pull request against `main`. Merge it only when
the user tells you to, even when CI is green. Until it is merged, fold
follow-up fixes into the commits they belong to: amending and force-pushing the
branch (`--force-with-lease`) is fine.

The user judges a change by how the application behaves, not by its code. When
reporting, lead with what changed for the user. For a change the user can see
in the app, leave a demo instance of the branch running and give its URL with
sign-in credentials you have verified work, plus screenshots where they help.
See `docs/agents/demo.md`.

This repository is public: keep personal details, private links and unrelated
projects out of code, comments, commits and PRs.

## Checks

In a fresh checkout or worktree, run `npm ci` and `npx prisma generate`, and
copy `.env` from the main checkout. The app needs a configured AI provider:
`src/lib/ai/services/leadService.ts` loads its model at import, so anything
importing it fails without one, and tests mock it.

A Husky pre-commit hook runs `eslint --fix` and Prettier on staged files. Never
bypass it or CI (`--no-verify`, `gh pr merge --admin`, disabling a job); fix the
underlying issue.

Before pushing, run the checks CI requires:

```bash
npm run format:check
npm run lint
npm run typecheck     # covers tests; the build does not
npm run test
npm run build
```

CI also requires these when you touch the files they cover:

- `helm-chart/`: it must render with
  `helm template briefing-officer helm-chart`. After changing `values.yaml`,
  regenerate the README with `npm run helm:readme`.
- a `uses:` in `.github/workflows/`: rerun `gh actions-lock` to update the
  lockfile.

## Releases

Release only via the `cutting-a-release` skill. Pushing a `v*` tag publishes
the container image and Helm chart, so never create tags or GitHub releases
outside it.

## Design

Colors, fonts, radii and the reading column are defined once in
`src/app/globals.css`; shadcn's semantic variables point at them, so components
use `bg-primary`, `text-muted-foreground` and the like.

- Color only through those tokens, never raw Tailwind palette classes
  (`text-blue-600`, `bg-black/50`, `fill-white`).
- Surfaces are flat: separate them with `border` and `bg-muted`, not shadows.
  Only floating things (menus, popovers, toasts) get a shadow.
- Text people read (summary leads, key facts, transcripts) uses `text-prose` in
  a column no wider than `max-w-content`. UI chrome stays compact.

## Code comments

Comments describe the code as it is: what it does when that isn't obvious, and
why. They don't record history: what was removed, replaced, restored or fixed,
or which bug or review led to a change. That belongs in the commit message and
the PR description.

## Spelling

Write American English everywhere: code, comments, docs, commit messages and PR
descriptions (`color`, `behavior`, `organize`, `center`, `gray`). This holds
when a skill is written in British English too: what it produces for this
repository uses American spelling.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `marcusleg/briefing-officer`, managed with
`gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: each of the five triage roles uses the label of the same
name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See
`docs/agents/domain.md`.

<!-- prettier-ignore-start -->

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- prettier-ignore-end -->
