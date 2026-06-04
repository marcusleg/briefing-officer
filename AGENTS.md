# AGENTS.md

Guidance for AI coding agents working in this repository.

## Before every commit

Run Prettier to format the code, otherwise the `format-check` CI job will fail:

```bash
npm run format
```

To verify formatting without writing changes (this is what CI runs):

```bash
npm run format:check
```

Prettier configuration lives in `.prettierrc.json` (with
`prettier-plugin-organize-imports`, `prettier-plugin-prisma`, and
`prettier-plugin-tailwindcss`). `proseWrap` is set to `always`, so Markdown is
reflowed too. Ignored paths are in `.prettierignore`.

## Other checks

Run these before pushing; CI gates on all of them:

```bash
npm run lint    # ESLint
npm run test    # Vitest unit + integration tests
npm run build   # Next.js production build
```

## Git

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) **without
scopes**. The commit history feeds `release-please`, which generates the
changelog and version bumps — non-conforming messages break the release
pipeline.

Valid prefixes:

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only changes
- `style:` — code style changes (formatting, semicolons, etc.)
- `refactor:` — code changes that don't change behavior
- `perf:` — performance improvement
- `test:` — adding or correcting tests
- `build:` — build system or dependency changes
- `ci:` — CI/CD configuration changes
- `chore:` — maintenance, other changes

Example: `feat: add user registration form`

### Co-authorship

Every commit must include `Co-Authored-By` trailer lines for:

1. **The coding agent** — the tool driving the session (e.g. `Claude Code`,
   `OpenCode`, `Codex`, `Aider`, `Cursor`)
2. **The LLM model** — the actual model loaded in your session, with whatever
   version identifier is current

Use a `noreply@` address from the relevant vendor (e.g. `noreply@anthropic.com`
for Claude models, `noreply@openai.com` for GPT models, `noreply@qwen.ai` for
Qwen models). When the agent and model come from the same vendor, both trailers
can share the same domain.

Example commit message:

```
feat: add user registration form

Co-Authored-By: Claude Code <noreply@anthropic.com>
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

### Workflow

Pushing directly to `main` is prohibited unless the user explicitly authorises
it for a specific commit.

Standard flow:

1. Create a branch named `<type>/<short-slug>`, where `<type>` matches a
   Conventional Commits prefix (e.g. `feat/user-registration`,
   `docs/add-git-instructions`).
2. Commit changes.
3. Push the branch.
4. Open a PR against `main` with `gh pr create`. The PR title should follow
   Conventional Commits too, since squash-merges use it as the commit message.
5. Wait for CI (`format-check`, `lint`, `test`, `build`) to pass.
6. The user reviews the PR before it can be merged. The user will either merge
   the PR themselves or explicitly instruct the agent to merge it. Do **not**
   merge a PR without that explicit instruction, even after CI passes.

If any check fails, fix the underlying issue and re-push. Do **not** bypass with
`git commit --no-verify`, `gh pr merge --admin`, or by disabling the failing
job.

### Commit granularity

Avoid making commits that are too small. Especially `feat:` and `fix:` commits
should be substantial enough to be meaningful in a changelog. Group related
changes into a single commit rather than committing every minor edit. At the
same time, keep changes sensibly sized — don't bundle unrelated work together.
