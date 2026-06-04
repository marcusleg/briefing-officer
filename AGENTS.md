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

Use [Conventional Commits](https://www.conventionalcommits.org/) **without scopes**.

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

1. **The coding agent** — e.g. `Co-Authored-By: OpenCode <noreply@opencode.ai>`
2. **The LLM model used** — e.g. `Co-Authored-By: Qwen 3.6 27B <noreply@opencode.ai>`

Use the actual agent name and model loaded in your session. Common agent
names: `Claude Code`, `OpenCode`, `Codex`. Common model examples:
`Claude Sonnet 4.6`, `Qwen 3.6 27B`, `GPT-4o`.

Example commit message:

```
feat: add user registration form

Co-Authored-By: OpenCode <noreply@opencode.ai>
Co-Authored-By: Qwen 3.6 27B <noreply@qwen.ai>
```

### Workflow

Pushing directly to `main` is discouraged and requires explicit user consent.

Typical git flow:

1. Create a branch
2. Commit changes
3. Push changes
4. Create a pull request
5. Merge PR if all checks pass

### Commit granularity

Avoid making commits that are too small. Especially `feat:` and `fix:` commits
should be substantial enough to be meaningful in a changelog. Group related
changes into a single commit rather than committing every minor edit. At the
same time, keep changes sensibly sized — don't bundle unrelated work together.
