import SignInForm from "@/app/sign-in/sign-in-form";
import Link from "next/link";
import { connection } from "next/server";

export default async function SignInPage() {
  // Render per request so the SSO settings come from the running server's
  // environment, not the one present at build time.
  await connection();

  const isGenericOAuthEnabled =
    process.env.AUTH_GENERIC_OAUTH_ENABLE === "true";
  const genericOAuthProviderName =
    process.env.AUTH_GENERIC_OAUTH_PROVIDER_NAME || "Single Sign-On";

  return (
    <div className="mx-auto max-w-sm space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Sign In</h1>
        <p className="text-muted-foreground">
          Enter your credentials to access your account
        </p>
      </div>

      <SignInForm
        isGenericOAuthEnabled={isGenericOAuthEnabled}
        genericOAuthProviderName={genericOAuthProviderName}
      />

      <p className="text-muted-foreground text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="text-primary font-medium hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
