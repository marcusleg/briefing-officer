import SignUpForm from "@/app/sign-up/sign-up-form";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-sm space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Sign Up</h1>
        <p className="text-muted-foreground">
          Enter your details to create your account
        </p>
      </div>

      <SignUpForm />

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="text-primary font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
