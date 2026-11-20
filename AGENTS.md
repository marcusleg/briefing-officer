# AGENTS.md

## Workflow

The user takes part in brainstorming and design. Once the spec is approved,
agents work unattended until a pull request is open.

1. **Design, with the user.** Brainstorm with `superpowers:brainstorming` until
   the user approves the spec. Ask only about user-observable behavior, scope
   and real trade-offs; decide implementation details yourself and record them
   in the spec.
2. **Everything after the spec, unattended.** Write the plan with
   `superpowers:writing-plans` without asking for its review, then execute it
   with `superpowers:subagent-driven-development` in a git worktree. Don't pause
   between plan, implementation, review and PR to ask whether to continue.
   Where a skill offers a choice (execution mode, how to finish the branch),
   take the path that ends in a PR.
3. **Report back** only when the PR is open, or when you hit a brick wall:
   still blocked after reasonable attempts, the spec turns out wrong or
   contradicts the code, or a change below needs sign-off.

Stop and ask before a change that is hard to undo, unless the approved spec
already describes it concretely:

- database schema changes and migrations
- API changes: HTTP routes, request or response shapes, anything outside
  clients rely on
- configuration operators set: environment variables, Helm values
- anything that deletes or rewrites existing user data

The user judges a change by how the application behaves, not by its code. When
reporting, lead with what changed for the user. Leave a demo instance of the
branch running and give its URL with sign-in credentials you have verified
work, plus screenshots where they help. Don't walk through code or diffs
unless asked.

## Checks

A Husky pre-commit hook runs `eslint --fix` and Prettier on staged files. Never
bypass it or CI (`--no-verify`, `gh pr merge --admin`, disabling a job); fix the
underlying issue.

Before pushing, run what CI gates on:

```bash
npm run format:check  # fix with `npm run format`
npm run lint
npm run typecheck     # covers tests; the build does not
npm run test
npm run build
```

Run `npx prisma generate` first in a fresh checkout or worktree. If you change
`helm-chart/values.yaml`, regenerate its README with `npm run helm:readme`.

## Git

- Commit messages follow Conventional Commits **without scopes**. The types
  decide the next version number, so pick them accurately.
- `feat:` and `fix:` subjects become the public changelog: describe the change
  from the end user's perspective. Implementation detail goes in the body.
- Group related changes into one commit; a `feat:` or `fix:` should be worth a
  changelog line. Don't bundle unrelated work.
- Never push to `main` unless the user authorizes that specific commit. Work on
  a branch and open a PR against `main`.
- PRs are merged by rebase, so every commit lands on `main` as-is and must
  conform on its own.
- Never merge a PR unless the user tells you to, even when CI is green. When
  told to, use `gh pr merge --rebase`.
- Release only via the `cutting-a-release` skill. Pushing a `v*` tag publishes
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

<!-- prettier-ignore-start -->

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- prettier-ignore-end -->
