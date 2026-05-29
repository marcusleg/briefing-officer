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
