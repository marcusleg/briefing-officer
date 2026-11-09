# User Settings Page

## Intent

Signed-in users have no way to change anything about their own account. Today
the only account-related UI is the user dropdown at the bottom of the sidebar
(OPML import/export, sign out). Users need one conventional settings page where
they can:

- change their name,
- see their email address (it can't be changed; see Email),
- change their password,
- see whether their account is connected to SSO, and connect or disconnect it.

The user asked for "the usual" settings page, kept simple. Anything not listed
above is out of scope.

## Goals

- One page at `/settings`, reachable from a new "Settings" item in the user
  dropdown menu.
- Keep the existing single `name` field; no database schema changes.
- Use Better Auth's built-in endpoints (`updateUser`, `changePassword`,
  `listAccounts`, `linkSocial`, `unlinkAccount`) rather than writing custom
  account-mutation code.

## Non-goals

- Splitting `name` into first and last name. Avatar/profile image, account
  deletion, session management, 2FA, theme or notification preferences.
- Sending email (the app has no mail transport). No email verification flow.
- Letting SSO-only users _set_ a first password.
- Changes to the admin user-management page.

## Anti-goals

- A settings page that lets a user lock themselves out (e.g. unlinking their
  only sign-in method).
- Leaking whether another account uses a given email address.
- Working around Better Auth to change emails it refuses to change.

## Constraints

- Next.js 16.4 (see `node_modules/next/dist/docs/` — APIs differ from older
  versions), React 19, Better Auth 1.7.12, Prisma 7 on SQLite, shadcn/ui
  components in `src/components/ui`, react-hook-form + zod for forms, `sonner`
  toasts. Follow the existing sign-up/sign-in forms for form style.
- Auth config lives in `src/lib/auth.ts`; client in `src/lib/auth-client.ts`.
- SSO is the single `genericOAuth` provider with `providerId: "generic"`,
  enabled by `AUTH_GENERIC_OAUTH_ENABLE=true` and named by
  `AUTH_GENERIC_OAUTH_PROVIDER_NAME` (default "Single Sign-On"). These are read
  at request time (`await connection()`), as in `src/app/sign-in/page.tsx` —
  container deployments set them at runtime, not build time.
- Account linking is already enabled with `trustedProviders: ["generic"]`.
  Better Auth refuses to link an SSO account whose email differs from the
  user's; we keep that default.
- The `proxy.ts` matcher only covers `/feed`; it must also cover `/settings`.

## Design

### Name

- `User.name` stays a single field; no schema change. The Profile card is one
  form: a "Name" input (required, trimmed), the read-only email, and a single
  "Save" button at the bottom, saved with `authClient.updateUser`. Sign-up and
  SSO sign-in are unchanged.

### Email

- The email address is shown read-only, with the note "Your email address can't
  be changed." Better Auth's `changeEmail` only changes a verified address by
  mailing a confirmation link, and the app sends no mail. (Revised after a demo:
  the first version let unverified users change it and showed verified ones
  read-only. The user chose not to work around Better Auth, so nobody can change
  it for now; `user.changeEmail` stays disabled.)
- `changePassword` only needs a valid session, not a fresh one.

### Password change

- Shown only when the user has a `credential` account (from `listAccounts`).
- Fields: current password, new password (min 8, matching sign-up), confirm new
  password. Calls `changePassword` with `revokeOtherSessions: true`.
- Users without a credential account see a short note that they sign in via SSO
  and have no password.

### Single sign-on

- A "Single sign-on" card, shown only when SSO is enabled or the user already
  has a `generic` account. Users who only have a password and no SSO option
  never see it. (Revised after a demo: a generic "Sign-in methods" list that
  showed "Email & password" confused password users.)
- The card states plainly whether the account is connected to the configured SSO
  provider name, and since when. It does not list the password account; the
  Password card covers that.
- When SSO is enabled and not yet linked: a "Connect" button calling
  `authClient.linkSocial({ provider: "generic", callbackURL: "/settings", errorCallbackURL: "/settings" })`.
  Without `errorCallbackURL`, Better Auth sends errors to its own `/error` page.
  Errors (e.g. email mismatch) arrive on `/settings` as `?error=…` (and
  optionally `&error_description=…`); show them in an alert on the page.
- When SSO is linked: a "Disconnect" button calling
  `authClient.unlinkAccount({ accountId })`. In Better Auth 1.7.12 the endpoint
  body is only `accountId`, and it matches Better Auth's own account row `id`
  (the `id` field from `listAccounts`), not the provider's `accountId` field.
  The button is disabled when the user has no password (SSO is then their only
  way to sign in), with a short note explaining why. Better Auth also rejects
  this server-side.
- `unlinkAccount` requires a _fresh_ session (created within the last 24 h, the
  Better Auth default `session.freshAge`; we don't change it). _Builder's call:_
  when it fails with `SESSION_NOT_FRESH`, show the message "For your security,
  sign out and sign in again before disconnecting." No re-auth redirect flow.
- When SSO is disabled but the user is still connected, the card shows the
  connection and lets them disconnect; it never offers to connect.

### Page and navigation

- Route `src/app/settings/page.tsx` with a `layout.tsx` that mirrors
  `src/app/admin/layout.tsx` (sidebar + content container).
- The page is a server component: it loads the session (redirects to `/sign-in`
  if missing), the user's accounts via `auth.api.listUserAccounts`, and the SSO
  env flags, then renders up to three cards — Profile (name, email), Password,
  Single sign-on — each a small client component with its own form and submit
  button.
- After each successful mutation, call `router.refresh()` so the sidebar name
  and page data update.
- Add `"/settings"` and `"/settings/:path*"` to the `proxy.ts` matcher.
- Add a "Settings" item (lucide `SettingsIcon`) to the user dropdown, linking to
  `/settings`, above the OPML items.

### Testing

- Component tests (Vitest + Testing Library, `tests/components/`) for each
  settings form: validation messages, correct `authClient` call arguments, and
  the conditional UI (read-only email; password section hidden without a
  credential account; disconnect disabled without a password; connect offered
  only when not connected). Mock `authClient` as existing component tests do.
- Update the existing user-dropdown test for the new menu item.
- No new e2e tests required.

## Left to the builder

- Exact component/file names inside `src/app/settings/`.
- Card copy and layout details, within the existing shadcn style.
