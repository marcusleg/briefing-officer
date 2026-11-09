# User Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Sessions" card on `/settings` that lists the user's active sessions
with a Sign out button each, or asks them to sign in again when their session is
older than 24 h, plus a `callbackURL` on `/sign-in` so they land back on
`/settings`.

**Architecture:** The settings page (server component) calls Better Auth's
`auth.api.listSessions` and treats a `SESSION_NOT_FRESH` error as the "stale"
state. A client `SessionList` renders rows (device label from `bowser`, dates
rendered only after mount in the viewer's time zone) and signs sessions out via
`authClient.revokeSession` / `authClient.signOut`. A pure `safeCallbackURL`
helper guards the new sign-in return path.

**Tech Stack:** Next.js 16.4, React 19, Better Auth 1.7.12, shadcn/ui, `sonner`,
lucide-react, `bowser` 2.x, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-user-sessions-design.md`

## Global Constraints

- Read `node_modules/next/dist/docs/` before writing Next.js code; APIs differ
  from older versions.
- Never bypass Better Auth's freshness rule: no direct Prisma reads of sessions,
  no `freshAge` change, no `src/lib/auth.ts` changes, no schema changes.
- New dependency: `bowser` only (MIT). Do not add `ua-parser-js` or any other
  parser.
- Copy, verbatim:
  - card title "Sessions", description "Devices where you're signed in."
  - pill "This device"
  - fallback "Unknown device"
  - details "Signed in <date>", "Last active <today | yesterday | date>",
    "Expires <date>", joined with " · "
  - button "Sign out"
  - toast "Session signed out"
  - stale text "For your security, sign in again to see your sessions." and
    button "Sign in again"
- Dates: `Intl.DateTimeFormat("en-US", { dateStyle: "medium" })` in the viewer's
  time zone (no `timeZone` option). Never show a time of day.
- Unsafe or missing `callbackURL` falls back to `/feed`.
- Follow `src/app/settings/single-sign-on.tsx` for button style (`outline`,
  `cursor-pointer`) and the `LoaderCircle` spinner.
- Only `git add` explicit paths. Never commit `.superpowers/`.
- Commits use Conventional Commits without scopes and end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never use
  `--no-verify`.

## Review Focus

1. **Double-clicking Sign out on a row.** That row's button is disabled while
   its revoke is pending, so `revokeSession` is called once. (Task 4)
2. **The current session missing from the list** (an admin impersonating the
   user, whose session Better Auth filters out). All rows render, none has the
   pill, and nothing crashes. (Task 4)
3. **An empty session list** (same cause). The card shows "No sessions to show."
   instead of an empty box. (Task 4)
4. **Hostile `callbackURL` values:** a repeated parameter (array), `/\evil.com`,
   `//evil.com`, `javascript:`. All of them fall back to `/feed`. (Task 1)
5. **`revokeSession` throwing** (network error rather than `{ error }`). Toast
   "Could not sign out the session" and re-enable the button. (Task 4)

---

### Task 1: Return to the requested page after signing in

**Files:**

- Create: `src/lib/safe-callback-url.ts`
- Modify: `src/app/sign-in/page.tsx`, `src/app/sign-in/sign-in-form.tsx`
- Test: `tests/unit/safeCallbackURL.test.ts`,
  `tests/components/sign-in/sign-in-form.test.tsx`

**Interfaces:**

- Produces: `safeCallbackURL(value: string | string[] | undefined): string`.
  `SignInForm` gains a required prop `callbackURL: string`.

- [ ] **Step 1: Write the failing unit tests** in
      `tests/unit/safeCallbackURL.test.ts`, one `it` per row, as
      `expect(safeCallbackURL(input)).toBe(expected)`:

| input                         | expected              |
| ----------------------------- | --------------------- |
| `"/settings"`                 | `"/settings"`         |
| `"/settings?tab=a#x"`         | `"/settings?tab=a#x"` |
| `undefined`                   | `"/feed"`             |
| `""`                          | `"/feed"`             |
| `["/settings", "/feed"]`      | `"/feed"`             |
| `"settings"`                  | `"/feed"`             |
| `"//evil.com"`                | `"/feed"`             |
| `"/\\evil.com"`               | `"/feed"`             |
| `"https://evil.com/settings"` | `"/feed"`             |
| `"javascript:alert(1)"`       | `"/feed"`             |

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run tests/unit/safeCallbackURL.test.ts`. Expected: FAIL (module
not found).

- [ ] **Step 3: Implement `safeCallbackURL` in `src/lib/safe-callback-url.ts`**

Return `/feed` unless the value is a string starting with `/`. Then parse it
with `new URL(value, "http://placeholder.invalid")`. Return `/feed` if the
origin differs, otherwise `pathname + search + hash`. The URL parser treats `\`
as `/`, which is what catches `/\evil.com`.

- [ ] **Step 4: Run the unit tests and confirm they pass**

Run: `npx vitest run tests/unit/safeCallbackURL.test.ts`. Expected: PASS.

- [ ] **Step 5: Write the failing component tests** in
      `tests/components/sign-in/sign-in-form.test.tsx`

Mock `authClient.signIn.email` and `authClient.signIn.social` as
`tests/components/settings/single-sign-on.test.tsx` mocks `authClient`. Give
`useRouter` a `{ push, refresh, back }` of `vi.fn()`s via
`vi.mocked(useRouter).mockReturnValue(...)`. Render with
`isGenericOAuthEnabled`, `genericOAuthProviderName="Authentik"` and
`callbackURL="/settings"`.

- `it("returns to the callback URL after password sign-in")`: fill email and
  password, click "Login", mock `signIn.email` resolving `{ data: {} }`. Expect
  `push` called with `"/settings"`.
- `it("passes the callback URL to single sign-on")`: click "Login with
  Authentik". Expect `signIn.social` called with
  `{ provider: "generic", callbackURL: "/settings" }`.

- [ ] **Step 6: Run them and confirm they fail**

Run: `npx vitest run tests/components/sign-in`. Expected: FAIL (push called with
`"/feed"`).

- [ ] **Step 7: Wire it up**

- `SignInForm`: add the `callbackURL: string` prop and use it in place of both
  `"/feed"` literals.
- `SignInPage`: accept
  `searchParams: Promise<{ callbackURL?: string | string[] }>`, `await` it, and
  pass `safeCallbackURL(callbackURL)`.

- [ ] **Step 8: Run the tests and typecheck**

Run:
`npx vitest run tests/unit/safeCallbackURL.test.ts tests/components/sign-in && npm run typecheck`.
Expected: PASS, no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/safe-callback-url.ts src/app/sign-in tests/unit/safeCallbackURL.test.ts tests/components/sign-in
git commit -m "feat: return to the page you came from after signing in"
```

### Task 2: Device label from the user agent

**Files:**

- Create: `src/app/settings/device.ts`
- Modify: `package.json`, `package-lock.json` (`npm install bowser@^2.15.0`)
- Test: `tests/unit/device.test.ts`

**Interfaces:**

- Produces:
  `describeDevice(userAgent: string | null | undefined): { label: string; isMobile: boolean }`

- [ ] **Step 1: Install bowser**

Run: `npm install bowser@^2.15.0`. Expected: added to `dependencies`.

- [ ] **Step 2: Write the failing tests** in `tests/unit/device.test.ts`. These
      outputs were checked against bowser 2.15.0:

| user agent                                                                                                                                | label               | isMobile |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------- |
| `Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0`                                                                  | `Firefox on Linux`  | false    |
| `Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1` | `Safari on iOS`     | true     |
| `Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1`          | `Safari on iOS`     | true     |
| `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36`                         | `Chrome on Windows` | false    |
| `Mozilla/5.0 (X11; Linux x86_64)` (OS only)                                                                                               | `Linux`             | false    |
| `okhttp/4.12.0`                                                                                                                           | `Unknown device`    | false    |
| `""`, `null`, `undefined`                                                                                                                 | `Unknown device`    | false    |

- [ ] **Step 3: Run them and confirm they fail**

Run: `npx vitest run tests/unit/device.test.ts`. Expected: FAIL.

- [ ] **Step 4: Implement `describeDevice` in `src/app/settings/device.ts`**

- Empty or missing input returns `Unknown device` straight away, because
  `Bowser.parse("")` throws.
- Treat a browser name of `""` or `"Mozilla"` as unknown. Bowser falls back to
  the first product token.
- `isMobile` is true when the platform type is `mobile` or `tablet`.
- The label is "B on O", or whichever one is known, or "Unknown device".

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run tests/unit/device.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit (temporary; squashed in Task 6)**

```bash
git add package.json package-lock.json src/app/settings/device.ts tests/unit/device.test.ts
git commit -m "wip: device label"
```

### Task 3: Session date labels

**Files:**

- Create: `src/app/settings/session-dates.ts`
- Test: `tests/unit/sessionDates.test.ts`

**Interfaces:**

- Produces: `formatSessionDate(date: Date): string` (medium date, local time
  zone), and `lastActiveLabel(date: Date, now: Date): string`, which returns
  `"today"`, `"yesterday"`, or `formatSessionDate(date)`.

- [ ] **Step 1: Write the failing tests**

Build dates with the local-time constructor (`new Date(2026, 10, 9, h, m)`) so
the tests pass in any time zone. Use `now = new Date(2026, 10, 9, 0, 30)`.

- `formatSessionDate(new Date(2026, 10, 9, 23, 59))` → `"Nov 9, 2026"`
- `lastActiveLabel(new Date(2026, 10, 9, 0, 1), now)` → `"today"`
- `lastActiveLabel(new Date(2026, 10, 8, 23, 59), now)` → `"yesterday"`
  (calendar day, not 24 h)
- `lastActiveLabel(new Date(2026, 10, 7, 12, 0), now)` → `"Nov 7, 2026"`
- Year boundary:
  `lastActiveLabel(new Date(2025, 11, 31, 22, 0), new Date(2026, 0, 1, 1, 0))` →
  `"yesterday"`

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run tests/unit/sessionDates.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement both functions in
      `src/app/settings/session-dates.ts`**

Compare local calendar days (year, month, date) rather than millisecond
differences.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/unit/sessionDates.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit (temporary)**

```bash
git add src/app/settings/session-dates.ts tests/unit/sessionDates.test.ts
git commit -m "wip: session dates"
```

### Task 4: SessionList component

**Files:**

- Create: `src/app/settings/session-list.tsx` (client component)
- Test: `tests/components/settings/session-list.test.tsx`

**Interfaces:**

- Consumes: `describeDevice` (Task 2), `formatSessionDate` and `lastActiveLabel`
  (Task 3).
- Produces:

  ```ts
  export interface SessionSummary {
    id: string;
    token: string;
    userAgent: string | null;
    createdAt: Date;
    updatedAt: Date; // "last active"
    expiresAt: Date;
  }
  export default function SessionList(props: {
    sessions: SessionSummary[];
    currentSessionId: string;
  }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing tests**

Mock `authClient.revokeSession` and `authClient.signOut`, `sonner`, and
`useRouter` (`push` and `refresh` spies) as in Task 1. Fix "now" with
`vi.useFakeTimers({ toFake: ["Date"] })` and
`vi.setSystemTime(new Date(2026, 10, 9, 12, 0))`. Fixtures (local-time dates):

- `current`: id `s1`, token `t1`, Firefox/Linux user agent from Task 2, created
  Nov 9, updated Nov 9 10:00, expires Nov 16.
- `phone`: id `s2`, token `t2`, iPhone user agent, created Nov 1, updated Nov 8,
  expires Nov 15.
- `old`: id `s3`, token `t3`, `userAgent: null`, created Oct 28, updated Nov 4,
  expires Nov 11.

Tests:

- `it("lists the current session first, then by last active")`: render
  `[old, phone, current]` with `currentSessionId="s1"`. List item text order is
  "Firefox on Linux", "Safari on iOS", "Unknown device".
- `it("marks only the current session")`: exactly one "This device" element,
  inside the "Firefox on Linux" row.
- `it("shows when each session signed in, was last active and expires")`: the
  current row contains "Signed in Nov 9, 2026", "Last active today" and "Expires
  Nov 16, 2026". The phone row contains "Last active yesterday". The old row
  contains "Last active Nov 4, 2026".
- `it("does not render dates on the server")`: `renderToString` from
  `react-dom/server` of the list does not contain `"Nov 16, 2026"` but does
  contain `"Firefox on Linux"`.
- `it("signs out another session")`: `revokeSession` resolves `{ data: {} }`.
  Click the phone row's "Sign out" (use `within(row)`). Expect `revokeSession`
  called with `{ token: "t2" }`, `toast.success` called with
  `"Session signed out"`, and `refresh` called.
- `it("disables a row's button while its sign-out is pending")`: `revokeSession`
  returns a never-resolving promise. Click twice. Expect one call and the button
  disabled.
- `it("shows an error when signing out fails")`: `revokeSession` resolves
  `{ error: { message: "Nope" } }` → `toast.error("Nope")` and no refresh. A
  second case rejects with an Error →
  `toast.error("Could not sign out the session")` and the button enabled again.
- `it("signs out of this device")`: click the current row's "Sign out". Expect
  `signOut` called, `revokeSession` not called, and `push` called with
  `"/sign-in"`.
- `it("renders without a current session")`: `currentSessionId="gone"`. All
  three rows render and there is no "This device".
- `it("says when there are no sessions")`: `sessions=[]` shows "No sessions to
  show."

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run tests/components/settings/session-list.test.tsx`. Expected:
FAIL.

- [ ] **Step 3: Implement `SessionList` in `src/app/settings/session-list.tsx`**

- A `<ul>` of `<li>` rows with `divide-y`. Each row has:
  - a `SmartphoneIcon` or `MonitorIcon` (from `describeDevice().isMobile`);
  - the label, plus `<Badge variant="secondary">This device</Badge>` on the
    current row;
  - the details line;
  - an outline "Sign out" button with an `aria-label` of `Sign out <label>`.
- Hide "Signed in" and "Expires" below `sm` with `hidden sm:inline`, along with
  their " · " separators.
- Render dates only after mount, using
  `useSyncExternalStore(() => () => {}, () => true, () => false)`. On the
  server, render the row without the details line.
- Sorting: the current session first, then `updatedAt` descending.
- Pending state: `pendingId: string | null`. A row's button is disabled and
  shows the spinner while its id is pending.
- The current row calls `authClient.signOut()`, then `router.push("/sign-in")`
  and `router.refresh()`.
- Any other row calls `authClient.revokeSession({ token })`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run tests/components/settings/session-list.test.tsx`. Expected:
PASS.

- [ ] **Step 5: Commit (temporary)**

```bash
git add src/app/settings/session-list.tsx tests/components/settings/session-list.test.tsx
git commit -m "wip: session list"
```

### Task 5: Stale state and page wiring

**Files:**

- Create: `src/app/settings/session-freshness.ts`,
  `src/app/settings/sign-in-again.tsx` (client component)
- Modify: `src/app/settings/page.tsx`
- Test: `tests/unit/sessionFreshness.test.ts`,
  `tests/components/settings/sign-in-again.test.tsx`

**Interfaces:**

- Consumes: `SessionList` and `SessionSummary` (Task 4).
- Produces: `isSessionNotFresh(error: unknown): boolean`, and a default export
  `SignInAgain()` component with no props.

- [ ] **Step 1: Write the failing tests**

- `tests/unit/sessionFreshness.test.ts`:
  - `isSessionNotFresh(new APIError("FORBIDDEN", { code: "SESSION_NOT_FRESH", message: "Session is not fresh" }))`
    is `true`. Import `APIError` from `better-auth/api`.
  - The same with code `"UNAUTHORIZED"` is `false`.
  - `new Error("x")` is `false`, and `undefined` is `false`.
- `tests/components/settings/sign-in-again.test.tsx`:
  - It shows "For your security, sign in again to see your sessions."
  - Clicking "Sign in again" calls `authClient.signOut` and then `push` with
    `"/sign-in?callbackURL=/settings"`.

- [ ] **Step 2: Run them and confirm they fail**

Run:
`npx vitest run tests/unit/sessionFreshness.test.ts tests/components/settings/sign-in-again.test.tsx`.
Expected: FAIL.

- [ ] **Step 3: Implement**

- `isSessionNotFresh`:
  `error instanceof APIError && error.body?.code === "SESSION_NOT_FRESH"`.
- `SignInAgain`: a paragraph plus an outline button, with the spinner while it's
  signing out.
- `page.tsx`:
  - After the existing account loading, call
    `auth.api.listSessions({ headers: await headers() })` in a try/catch.
  - On `isSessionNotFresh`, set `sessions = null`. Rethrow anything else.
  - Map each result to `SessionSummary`, with `userAgent ?? null` and the three
    dates wrapped in `new Date(...)`.
  - Append a fourth `Card` after Single sign-on: `CardTitle` "Sessions",
    `CardDescription` "Devices where you're signed in."
  - The content is
    `<SessionList sessions={sessions} currentSessionId={session.session.id} />`,
    or `<SignInAgain />` when `sessions` is `null`.

- [ ] **Step 4: Run the tests and typecheck**

Run:
`npx vitest run tests/unit/sessionFreshness.test.ts tests/components/settings && npm run typecheck`.
Expected: PASS.

- [ ] **Step 5: Commit (temporary)**

```bash
git add src/app/settings tests/unit/sessionFreshness.test.ts tests/components/settings/sign-in-again.test.tsx
git commit -m "wip: sessions card"
```

### Task 6: Verify in the app, squash, open the PR

- [ ] **Step 1: Check the real app**

Run `npm run dev` and sign in. On `/settings`, check:

- The Sessions card lists this browser with the pill.
- Signing in from a second browser adds a row.
- Signing that row out removes it, and the second browser lands on `/sign-in` on
  its next navigation.
- At a 375px viewport, only "Last active" shows.
- Stale state: set this session's `createdAt` back 2 days in the dev SQLite
  database, reload, and check the card shows "Sign in again". Using it returns
  you to `/settings` after signing in.

- [ ] **Step 2: Squash the `wip:` commits into one**

```bash
git reset --soft HEAD~4
git commit -m "feat: list your sessions on the settings page and sign any of them out" -m "<body: Better Auth listSessions/revokeSession, the 24 h freshness rule and the Sign in again state, bowser for device labels>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected `git log --oneline main..` output: the spec and plan `docs:` commits,
Task 1's `feat:`, and this `feat:`.

- [ ] **Step 3: Run every CI check**

Run:
`npm run format && npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build`.
Expected: all pass. If `format` changed files, add them to the last commit.

- [ ] **Step 4: Rename the branch, push and open the PR**

`git branch -m feat/user-sessions`, push with `-u`, then
`gh pr create --base main`. The PR body ends with the Claude Code attribution
line. Do not merge.
