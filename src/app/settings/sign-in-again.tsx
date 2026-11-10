"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const SignInAgain = () => {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const signInAgain = async () => {
    setSubmitting(true);
    try {
      await authClient.signOut();
      router.push("/sign-in?callbackURL=/settings");
    } catch {
      toast.error("Could not sign out");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">
        For your security, sign in again to see your sessions.
      </p>
      <Button
        variant="outline"
        className="cursor-pointer"
        disabled={submitting}
        onClick={signInAgain}
      >
        {submitting ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          "Sign in again"
        )}
      </Button>
    </div>
  );
};

export default SignInAgain;
