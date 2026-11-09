"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export interface SsoAccount {
  id: string; // Better Auth account row id — what unlinkAccount expects
  createdAt: Date;
}

interface SingleSignOnProps {
  account?: SsoAccount;
  canDisconnect: boolean;
  providerName: string;
  linkError?: string;
}

const SSO_PROVIDER_ID = "generic";

// Fixed locale and time zone so server and browser render the same text.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const SingleSignOn = ({
  account,
  canDisconnect,
  providerName,
  linkError,
}: SingleSignOnProps) => {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const connect = async () => {
    setSubmitting(true);
    try {
      const result = await authClient.linkSocial({
        provider: SSO_PROVIDER_ID,
        callbackURL: "/settings",
        errorCallbackURL: "/settings",
      });

      if (result.error) {
        toast.error(result.error.message || "Could not connect your account");
      }
    } catch {
      toast.error("Could not connect your account");
    } finally {
      setSubmitting(false);
    }
  };

  const disconnect = async (accountId: string) => {
    setSubmitting(true);
    try {
      const result = await authClient.unlinkAccount({ accountId });

      if (result.error) {
        if (result.error.code === "SESSION_NOT_FRESH") {
          toast.error(
            "For your security, sign out and sign in again before disconnecting.",
          );
        } else {
          toast.error(
            result.error.message || "Could not disconnect your account",
          );
        }
        return;
      }

      toast.success(`${providerName} disconnected`);
      router.refresh();
    } catch {
      toast.error("Could not disconnect your account");
    } finally {
      setSubmitting(false);
    }
  };

  const spinner = <LoaderCircle className="size-4 animate-spin" />;

  return (
    <div className="space-y-4">
      {linkError && (
        <Alert variant="destructive">
          <AlertDescription>{linkError}</AlertDescription>
        </Alert>
      )}

      {account ? (
        <>
          <p className="text-sm">
            Your account is connected to {providerName} since{" "}
            <time dateTime={account.createdAt.toISOString()}>
              {dateFormatter.format(account.createdAt)}
            </time>
            .
          </p>
          {!canDisconnect && (
            <p className="text-muted-foreground text-sm">
              You can&apos;t disconnect it because you have no password to sign
              in with.
            </p>
          )}
          <Button
            variant="outline"
            className="cursor-pointer"
            disabled={submitting || !canDisconnect}
            aria-label={`Disconnect ${providerName}`}
            onClick={() => disconnect(account.id)}
          >
            {submitting ? spinner : "Disconnect"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm">
            Your account isn&apos;t connected to {providerName}.
          </p>
          <Button
            variant="outline"
            className="cursor-pointer"
            disabled={submitting}
            aria-label={`Connect ${providerName}`}
            onClick={connect}
          >
            {submitting ? spinner : `Connect ${providerName}`}
          </Button>
        </>
      )}
    </div>
  );
};

export default SingleSignOn;
