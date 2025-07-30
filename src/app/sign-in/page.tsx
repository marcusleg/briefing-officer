import SignInForm from "@/app/sign-in/sign-in-form";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-sm space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Sign In</h1>
        <p className="text-gray-500">
          Enter your credentials to access your account
        </p>
      </div>

      <SignInForm />

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
