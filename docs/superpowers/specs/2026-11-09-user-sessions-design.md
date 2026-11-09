# User Sessions on the Settings Page

## Intent

Signed-in users can't see where else they're signed in, and can't sign out a
device they no longer use or trust except by changing their password (which
signs out every other session at once). The user wants a list of a user's
sessions on `/settings` because it's useful information and gives users more
control: each session gets its own Sign out button.

## Goals

- A fourth "Sessions" card on `/settings`, below "Single sign-on".
- One row per active session, readable on desktop and phones.
- Sign out any single session, including the current one.
- Respect Better Auth's own security model for listing sessions (see Fresh
  sessions) instead of working around it.
- `/sign-in` can send the user back to the page they came from after signing in,
  so "Sign in again" lands them on `/settings`.

## Non-goals

- A "sign out all other sessions" button. (Changing the password already does
  that.)
- Showing IP addresses or exact last-active times.
- Showing sessions an admin opened by impersonating the user.
- Changing Better Auth's session settings (`freshAge`, `expiresIn`,
  `updateAge`), the database schema, or the admin pages.
- Passing a return address from `proxy.ts` redirects to `/sign-in`. Only the
  "Sign in again" button uses `callbackURL` for now.

## Anti-goals

- Bypassing the 24-hour freshness rule, whether by reading sessions straight
  from the database or by setting `freshAge: 0`. Better Auth's `/list-sessions`
  returns every session's token, and `revokeSession` takes a token. So the rule
  is what stops someone holding a stolen, older session cookie from seeing the
  user's other sessions or signing the real user out. `freshAge: 0` would also
  remove the same protection from `unlinkAccount`.
- An open redirect: `callbackURL` must never send the user to another site.

## Constraints

- Next.js 16.4 (read `node_modules/next/dist/docs/` before writing code; APIs
  differ from older versions), React 19, Better Auth 1.7.12, shadcn/ui in
  `src/components/ui`, `sonner` toasts, lucide icons. Follow the existing
  settings cards in `src/app/settings/` (e.g. `single-sign-on.tsx`) for
  structure, copy tone, button and spinner style.
- Better Auth 1.7.12 behaviour, verified in
  `node_modules/better-auth/dist/api/routes/session.mjs`:
  - `/list-sessions` (`auth.api.listSessions` / `authClient.listSessions`) uses
    `freshSessionMiddleware`. It throws `FORBIDDEN` with code
    `SESSION_NOT_FRESH` when the _current_ session was created 24 h or more ago
    (default `freshAge`). It returns only unexpired sessions, including `id`,
    `token`, `createdAt`, `updatedAt`, `expiresAt`, `userAgent`, `ipAddress`.
  - The admin plugin's after-hook on `/list-sessions` already removes sessions
    with `impersonatedBy` set. Nothing extra is needed.
  - `/revoke-session` (`authClient.revokeSession({ token })`) needs only a valid
    session (not a fresh one) and only deletes sessions belonging to the current
    user.
  - `updatedAt` is refreshed at most once per `updateAge` (default 1 day), so
    "last active" is only accurate to the day.
  - Sessions last 7 days (default `expiresIn`).
- User-agent parsing: `bowser` 2.x (MIT). Not `ua-parser-js` (v2 is AGPL). The
  user has turned down a dependency before over its licence, so check the
  licence of anything else you add.
- `/sign-in` currently always sends users to `/feed` after signing in, both for
  password sign-in (`router.push("/feed")`) and SSO
  (`signIn.social({ callbackURL: "/feed" })`) in
  `src/app/sign-in/sign-in-form.tsx`.

## Design

### Sessions card: fresh session (signed in less than 24 h ago)

- Title "Sessions", description "Devices where you're signed in."
- A stacked list (not a table), one row per session, separated by borders:
  - **Icon:** lucide monitor icon, or a phone icon when the user agent is a
    mobile or tablet device.
  - **Device:** "<Browser> on <OS>", e.g. "Firefox on Linux", "Safari on iOS",
    from the user agent via `bowser`. When only one of browser and OS is known,
    show that one alone (e.g. "Android"). When neither is known, or the user
    agent is missing, show "Unknown device". _(Builder's call, settled during
    review.)_
  - **"This device" pill** on the current session. It's muted: shadcn `Badge`
    with a low-contrast variant (`secondary` or `outline`), not the
    high-contrast default.
  - **Details** under the device name, joined with " · ": "Signed in <date>",
    "Last active <today | yesterday | date>", "Expires <date>". On narrow
    screens (below Tailwind's `sm`) only "Last active" is shown.
  - **Sign out** button (outline) on the right of every row, current session
    included.
- **Order:** current session first, then the rest by last active (`updatedAt`),
  newest first.
- **Dates:** medium date style like `single-sign-on.tsx` ("Nov 9, 2026"), but
  all three dates are formatted in the viewer's time zone on the client, not in
  fixed UTC as `single-sign-on.tsx` does, so they agree with "today" and
  "yesterday", which follow the viewer's local day. Never show a time of day.
  _(Builder's call, settled during review: avoid a hydration mismatch, e.g. by
  rendering the dates only after mount.)_
- **Sign out on another session:** call `authClient.revokeSession({ token })`
  straight away, with no confirmation dialog. On success, toast "Session signed
  out" and `router.refresh()`. On failure, toast the error. Show a spinner on
  that row's button while it runs.
- **Sign out on the current session:** do what the user dropdown's Sign out does
  (`authClient.signOut()`, then go to `/sign-in`).

### Sessions card: stale session (signed in 24 h or more ago)

- Same title. Body text: "For your security, sign in again to see your
  sessions."
- A "Sign in again" button that signs out (`authClient.signOut()`) and then goes
  to `/sign-in?callbackURL=/settings`.

### Fresh or stale: how the page decides

- `src/app/settings/page.tsx` (server component) calls
  `auth.api.listSessions({ headers })` and catches the Better Auth `APIError`
  whose code is `SESSION_NOT_FRESH`. That error means stale. Any other error is
  rethrown. This way the 24 h threshold comes only from Better Auth.
- The current session's `id` comes from the `getSession` result the page already
  loads.

### Return to the page after signing in

- `/sign-in` reads a `callbackURL` search parameter and passes the sanitised
  value to `SignInForm`.
- Sanitising, in a small pure helper with unit tests: accept the value only if
  it starts with a single `/` (not `//`, not `/\`) and contains no scheme or
  host. Otherwise use `/feed`. Missing or empty also means `/feed`.
- `SignInForm` uses that path for both `router.push(...)` after password sign-in
  and `callbackURL` in `signIn.social(...)`.

## Testing

- Component tests (Vitest + Testing Library under `tests/components/settings/`;
  mock `authClient` as the existing settings tests do) for:
  - Rows: device text, the pill only on the current session, "Unknown device"
    fallback, order, and the three details.
  - Revoking another session: calls `revokeSession` with that session's token,
    toasts and refreshes.
  - Signing out the current session: calls `signOut` and navigates to
    `/sign-in`.
  - The stale state: message shown, and "Sign in again" signs out and goes to
    `/sign-in?callbackURL=/settings`.
  - The sign-in form uses the given return path for both sign-in methods.
- Unit tests for the `callbackURL` sanitiser (valid paths, `//host`, `/\host`,
  absolute URLs, `javascript:`, empty) and for the user-agent → device-label
  helper.
- No new e2e tests required.

## Left to the builder

- File and component names inside `src/app/settings/` and helper locations.
- How the "today/yesterday" labelling is computed, as long as it's tested and
  renders without a hydration mismatch.
- Exact Tailwind classes, within the existing shadcn style and the layout above.
