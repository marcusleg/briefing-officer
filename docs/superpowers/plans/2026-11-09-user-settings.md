# User Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/settings` page where a signed-in user changes their name, email
and password, and sees, connects and disconnects their SSO sign-in.

**Architecture:** A server-rendered page at `src/app/settings/page.tsx` loads
the session, the user's accounts and the SSO env flags, and renders four small
client components (name form, email form, password form, sign-in methods). Each
client component calls Better Auth's client API directly and calls
`router.refresh()` after a successful change. No database changes.

**Tech Stack:** Next.js 16.4 (App Router; read `node_modules/next/dist/docs/`
before using unfamiliar APIs), React 19, Better Auth 1.7.12, shadcn/ui,
react-hook-form + zod 4, sonner, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-user-settings-design.md`

## Global Constraints

- No Prisma schema changes; `User.name` stays a single field.
- SSO provider id is `"generic"`; enabled by
  `process.env.AUTH_GENERIC_OAUTH_ENABLE === "true"`; display name
  `process.env.AUTH_GENERIC_OAUTH_PROVIDER_NAME || "Single Sign-On"`; read at
  request time after `await connection()`.
- Credential account provider id is `"credential"`, shown as
  `"Email & password"`.
- Password minimum length: 8 (same as sign-up, message
  `"Password must be at least 8 characters"`).
- Follow the form style of `src/app/sign-up/sign-up-form.tsx` (shadcn `Form`,
  `zodResolver`, inputs and submit disabled while submitting, `LoaderCircle`
  spinner, `toast` from `sonner`). Buttons get `cursor-pointer`.
- Component tests mock `@/lib/auth-client` with `vi.mock` as in
  `tests/components/navigation/user-dropdown-menu.test.tsx`. `next/navigation`'s
  `useRouter` is already mocked globally in `tests/components/setup.ts`.
- Commits: Conventional Commits without scope; end every commit message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never
  `--no-verify`.
- The per-task commits are squashed by the controller into one user-facing
  `feat: add a settings page for name, email, password and sign-in methods`
  commit before pushing, so the changelog gets one entry.

## Review Focus

1. Whitespace-only or unchanged input: a name of `"   "` is rejected
   client-side; submitting the current name or the current email (any case) does
   not call the API and shows "That's already your name/email".
2. Email silently not changed (address taken): after `changeEmail` succeeds, the
   fresh session email still differs from the requested one → error toast "Could
   not change your email address", no success toast.
3. Wrong current password: the server error message is shown in a toast, and the
   form keeps its values so the user can retry.
4. SSO link error query params: an unknown `error` code or a hostile
   `error_description` is shown as plain text in an alert, never as HTML, and
   the page still renders.
5. Disconnecting with a stale session (`SESSION_NOT_FRESH`): the user sees "For
   your security, sign out and sign in again before disconnecting." rather than
   a raw error.

---

### Task 1: Name and email forms

**Files:**

- Modify: `src/lib/auth.ts` (add `user.changeEmail` to the `betterAuth` options)
- Create: `src/app/settings/name-form.tsx`
- Create: `src/app/settings/email-form.tsx`
- Test: `tests/components/settings/name-form.test.tsx`
- Test: `tests/components/settings/email-form.test.tsx`

**Interfaces:**

- Produces: `export default function NameForm({ name }: { name: string })`
- Produces:
  `export default function EmailForm({ email, emailVerified }: { email: string; emailVerified: boolean })`

- [ ] **Step 1: Write the failing tests**

Mock `@/lib/auth-client` as
`{ authClient: { updateUser: vi.fn(), changeEmail: vi.fn(), getSession: vi.fn() } }`
and `sonner` as `{ toast: { success: vi.fn(), error: vi.fn() } }`.

`name-form.test.tsx`:

- `"saves a trimmed new name"`: render `<NameForm name="Ada" />`, clear the
  "Name" input, type `"  Ada Lovelace  "`, click "Save name" → `updateUser`
  called with `{ name: "Ada Lovelace" }`; `toast.success` called.
- `"rejects a blank name"`: type `"   "`, submit → text `"Name is required"`
  shown; `updateUser` not called.
- `"does not save an unchanged name"`: submit `"Ada"` → text
  `"That's already your name"`; `updateUser` not called.
- `"shows the server error"`: `updateUser` resolves
  `{ error: { message: "Boom" } }` → `toast.error` called with `"Boom"`.

`email-form.test.tsx`:

- `"changes the email"`: `changeEmail` resolves `{ data: { status: true } }`,
  `getSession` resolves `{ data: { user: { email: "new@example.com" } } }`;
  render `<EmailForm email="old@example.com" emailVerified={false} />`, set
  "Email" to `"new@example.com"`, click "Change email" → `changeEmail` called
  with `{ newEmail: "new@example.com" }`; `getSession` called with
  `{ query: { disableCookieCache: true } }`; `toast.success` called.
- `"reports an email that did not change"`: same, but `getSession` returns
  `old@example.com` → `toast.error` called with
  `"Could not change your email address"`; `toast.success` not called.
- `"does not submit the current email in another case"`: submit
  `"OLD@example.com"` → text `"That's already your email"`; `changeEmail` not
  called.
- `"is read-only for a verified email"`: `emailVerified={true}` → the "Email"
  input is disabled, there is no "Change email" button, and the text
  `"A verified email address can't be changed here."` is shown.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project components tests/components/settings` Expected:
FAIL (modules not found)

- [ ] **Step 3: Enable email change in `src/lib/auth.ts`**

Add
`user: { changeEmail: { enabled: true, updateEmailWithoutVerification: true } }`
to the `betterAuth({...})` options.

- [ ] **Step 4: Implement `NameForm` and `EmailForm`**

Both are `"use client"` components. Zod schemas trim input
(`z.string().trim().min(1, "Name is required")`, `z.email()` for the email) and
use `.refine` against the current prop for the "already your …" messages (email
compared case-insensitively). On success call `router.refresh()` and
`toast.success("Name updated")` / `toast.success("Email updated")`. `EmailForm`
checks the result of
`authClient.getSession({ query: { disableCookieCache: true } })` after a
successful `changeEmail` and compares lowercase emails.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project components tests/components/settings` Expected:
PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/app/settings tests/components/settings
git commit -m "feat: let users change their name and email address"
```

### Task 2: Password form

**Files:**

- Create: `src/app/settings/password-form.tsx`
- Test: `tests/components/settings/password-form.test.tsx`

**Interfaces:**

- Produces: `export default function PasswordForm()`

- [ ] **Step 1: Write the failing tests**

Mock `authClient.changePassword` and `sonner` as in Task 1.

- `"changes the password and signs out other sessions"`: fill "Current password"
  `"old-secret"`, "New password" `"new-secret-1"`, "Confirm new password"
  `"new-secret-1"`, click "Change password" → `changePassword` called with
  `{ currentPassword: "old-secret", newPassword: "new-secret-1", revokeOtherSessions: true }`;
  `toast.success` called; all three inputs are empty afterwards.
- `"requires 8 characters"`: new password `"short"` → text
  `"Password must be at least 8 characters"`; not called.
- `"requires matching passwords"`: confirm differs → text
  `"Passwords don't match"`; not called.
- `"keeps the input after a wrong current password"`: `changePassword` resolves
  `{ error: { message: "Invalid password" } }` → `toast.error` called with
  `"Invalid password"`; "Current password" input still has `"old-secret"`.

- [ ] **Step 2: Run the tests to verify they fail**

Run:
`npx vitest run --project components tests/components/settings/password-form.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `PasswordForm`**

`"use client"`; `type="password"` inputs with `autoComplete` `current-password`
/ `new-password`; `form.reset()` on success;
`toast.success("Password changed")`.

- [ ] **Step 4: Run the tests to verify they pass**

Run:
`npx vitest run --project components tests/components/settings/password-form.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/password-form.tsx tests/components/settings/password-form.test.tsx
git commit -m "feat: let users change their password"
```

### Task 3: Sign-in methods

**Files:**

- Create: `src/app/settings/sign-in-methods.tsx`
- Test: `tests/components/settings/sign-in-methods.test.tsx`

**Interfaces:**

- Produces:

```ts
export interface SignInMethod {
  id: string; // Better Auth account row id — what unlinkAccount expects
  providerId: string; // "credential" | "generic" | other
  createdAt: Date;
}

export default function SignInMethods(props: {
  accounts: SignInMethod[];
  ssoEnabled: boolean;
  ssoProviderName: string;
  linkError?: string; // already-resolved text to show, from the page
}): JSX.Element;
```

- [ ] **Step 1: Write the failing tests**

Mock `authClient.linkSocial` and `authClient.unlinkAccount`, and `sonner`.
Fixtures:
`credential = { id: "acc-1", providerId: "credential", createdAt: new Date("2026-01-02") }`,
`sso = { id: "acc-2", providerId: "generic", createdAt: new Date("2026-03-04") }`.

- `"lists connected methods with readable names"`: accounts `[credential, sso]`,
  `ssoProviderName="Authentik"` → texts `"Email & password"` and `"Authentik"`
  shown.
- `"connects SSO"`: accounts `[credential]`, `ssoEnabled` → click "Connect
  Authentik" → `linkSocial` called with
  `{ provider: "generic", callbackURL: "/settings", errorCallbackURL: "/settings" }`.
- `"hides connect when SSO is disabled"`: `ssoEnabled={false}` → no "Connect …"
  button.
- `"disconnects SSO"`: accounts `[credential, sso]` → click "Disconnect
  Authentik" → `unlinkAccount` called with `{ accountId: "acc-2" }`.
- `"cannot disconnect the only sign-in method"`: accounts `[sso]` → "Disconnect
  Authentik" button is disabled.
- `"asks for a fresh sign-in"`: `unlinkAccount` resolves
  `{ error: { code: "SESSION_NOT_FRESH", message: "Session is not fresh" } }` →
  `toast.error` called with
  `"For your security, sign out and sign in again before disconnecting."`.
- `"shows a link error as text"`: `linkError="<b>email_doesn't_match</b>"` → an
  element with role `alert` whose `textContent` contains that literal string,
  and no `b` element is rendered.

- [ ] **Step 2: Run the tests to verify they fail**

Run:
`npx vitest run --project components tests/components/settings/sign-in-methods.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `SignInMethods`**

`"use client"`; a list (one row per account: name, "Connected" date via the
existing `IntlDateTime` component or `toLocaleDateString`, and the Disconnect
button for `generic` rows only); the Connect button only when `ssoEnabled` and
there is no `generic` account; `linkError` in the shadcn `Alert`
(`variant="destructive"`). Unknown provider ids show the raw id.
`router.refresh()` and `toast.success` after a successful disconnect.

- [ ] **Step 4: Run the tests to verify they pass**

Run:
`npx vitest run --project components tests/components/settings/sign-in-methods.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/sign-in-methods.tsx tests/components/settings/sign-in-methods.test.tsx
git commit -m "feat: show connected sign-in methods and let users connect or disconnect SSO"
```

### Task 4: Settings page, route protection and menu entry

**Files:**

- Create: `src/app/settings/layout.tsx` (copy of `src/app/admin/layout.tsx`'s
  structure, component renamed `SettingsLayout`)
- Create: `src/app/settings/page.tsx`
- Modify: `src/proxy.ts` (matcher)
- Modify: `src/components/navigation/user-dropdown-menu.tsx`
- Test: `tests/components/navigation/user-dropdown-menu.test.tsx`

**Interfaces:**

- Consumes: `NameForm`, `EmailForm` (Task 1), `PasswordForm` (Task 2),
  `SignInMethods` and `SignInMethod` (Task 3).

- [ ] **Step 1: Update the dropdown test (failing)**

In `"lists the OPML actions above Sign out"` (rename to
`"lists Settings and the OPML actions above Sign out"`) expect
`["Settings", "Import OPML", "Export OPML", "Sign out"]`. Add
`"links to the settings page"`: the "Settings" menuitem has `href="/settings"`.

- [ ] **Step 2: Run it to verify it fails**

Run:
`npx vitest run --project components tests/components/navigation/user-dropdown-menu.test.tsx`
Expected: FAIL

- [ ] **Step 3: Add the menu item**

First item in `DropdownMenuContent`: `DropdownMenuItem asChild` wrapping a
`next/link` `Link href="/settings"` with lucide `SettingsIcon` and `"Settings"`,
then a `DropdownMenuSeparator` before the OPML items.

- [ ] **Step 4: Run it to verify it passes**

Run:
`npx vitest run --project components tests/components/navigation/user-dropdown-menu.test.tsx`
Expected: PASS

- [ ] **Step 5: Protect the route**

`src/proxy.ts` matcher becomes
`["/feed", "/feed/:path*", "/settings", "/settings/:path*"]`; extend the comment
to say `/settings` is matched for the same reason.

- [ ] **Step 6: Implement the page**

`export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; error_description?: string }> })`:

1. `await connection()`; get the session with
   `auth.api.getSession({ headers: await headers() })`; `redirect("/sign-in")`
   if missing.
2. `accounts = await auth.api.listUserAccounts({ headers: await headers() })`,
   mapped to `SignInMethod[]` (`id`, `providerId`, `createdAt`).
3. SSO flags exactly as in `src/app/sign-in/page.tsx`.
4. `linkError`: if `error` is set,
   `` `Could not connect your ${ssoProviderName} account: ${error_description ?? error}` ``.
5. Render an `h1` "Settings" and three shadcn `Card`s: "Profile" (`NameForm`,
   `EmailForm` with `session.user.email` / `session.user.emailVerified`),
   "Password" (`PasswordForm` if any account has `providerId === "credential"`,
   otherwise the text
   `` `You sign in with ${ssoProviderName}, so your account has no password.` ``),
   "Sign-in methods" (`SignInMethods`). Constrain width (`max-w-2xl`) and stack
   cards with `space-y-6`.

- [ ] **Step 7: Verify the whole project**

Run, all must succeed: `npm run lint`, `npm run typecheck`, `npm run test`,
`npm run build`, `npm run format:check` (run `npm run format` first if it
fails).

- [ ] **Step 8: Commit**

```bash
git add src/app/settings/layout.tsx src/app/settings/page.tsx src/proxy.ts src/components/navigation/user-dropdown-menu.tsx tests/components/navigation/user-dropdown-menu.test.tsx
git commit -m "feat: add a settings page to the user menu"
```
