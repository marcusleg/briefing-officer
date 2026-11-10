import { describeDevice } from "@/app/settings/device";
import { linkErrorMessage } from "@/app/settings/link-error";
import PasswordForm from "@/app/settings/password-form";
import ProfileForm from "@/app/settings/profile-form";
import SessionList, { type SessionSummary } from "@/app/settings/session-list";
import SignInAgain from "@/app/settings/sign-in-again";
import SingleSignOn from "@/app/settings/single-sign-on";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>;
}) {
  // Render per request so the SSO settings come from the running server's
  // environment, not the one present at build time.
  await connection();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  });
  const hasPassword = accounts.some(
    (account) => account.providerId === "credential",
  );
  const ssoAccount = accounts.find(
    (account) => account.providerId === "generic",
  );

  // Better Auth only lists sessions for a fresh one; otherwise ask to sign in
  // again.
  let sessions: SessionSummary[] | null;
  try {
    const result = await auth.api.listSessions({ headers: await headers() });
    sessions = result.map((item) => ({
      id: item.id,
      token: item.token,
      device: describeDevice(item.userAgent),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      expiresAt: item.expiresAt,
    }));
  } catch (error) {
    const isNotFresh =
      error instanceof APIError && error.body?.code === "SESSION_NOT_FRESH";
    if (!isNotFresh) {
      throw error;
    }
    sessions = null;
  }

  const isGenericOAuthEnabled =
    process.env.AUTH_GENERIC_OAUTH_ENABLE === "true";
  const genericOAuthProviderName =
    process.env.AUTH_GENERIC_OAUTH_PROVIDER_NAME || "Single Sign-On";

  const { error, error_description } = await searchParams;
  const linkError = linkErrorMessage(
    error,
    error_description,
    genericOAuthProviderName,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm name={session.user.name} email={session.user.email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          {hasPassword ? (
            <PasswordForm />
          ) : (
            <CardDescription>
              {`You sign in with ${genericOAuthProviderName}, so your account has no password.`}
            </CardDescription>
          )}
        </CardContent>
      </Card>

      {/* Only users who can use SSO, or already have, need to see it. */}
      {(isGenericOAuthEnabled || ssoAccount) && (
        <Card>
          <CardHeader>
            <CardTitle>Single sign-on</CardTitle>
            <CardDescription>
              {`Sign in with your ${genericOAuthProviderName} account instead of a password.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SingleSignOn
              account={
                ssoAccount && {
                  id: ssoAccount.id,
                  createdAt: new Date(ssoAccount.createdAt),
                }
              }
              canDisconnect={hasPassword}
              providerName={genericOAuthProviderName}
              linkError={linkError}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            Devices where you&apos;re signed in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions ? (
            <SessionList
              sessions={sessions}
              currentSessionId={session.session.id}
            />
          ) : (
            <SignInAgain />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
