import SignInForm from "@/app/sign-in/sign-in-form";
import { safeCallbackURL } from "@/lib/safe-callback-url";
import Link from "next/link";
import { connection } from "next/server";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string | string[] }>;
}) {
  // Render per request so the SSO settings come from the running server's
  // environment, not the one present at build time.
  await connection();

  const { callbackURL } = await searchParams;

  const isGenericOAuthEnabled =
    process.env.AUTH_GENERIC_OAUTH_ENABLE === "true";
  const genericOAuthProviderName =
    process.env.AUTH_GENERIC_OAUTH_PROVIDER_NAME || "Single Sign-On";

  return (
    <div className="mx-auto max-w-sm space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Sign In</h1>
        <p className="text-gray-500">
          Enter your credentials to access your account
        </p>
      </div>

      <SignInForm
        isGenericOAuthEnabled={isGenericOAuthEnabled}
        genericOAuthProviderName={genericOAuthProviderName}
        callbackURL={safeCallbackURL(callbackURL)}
      />

      <p className="text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-blue-600 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
