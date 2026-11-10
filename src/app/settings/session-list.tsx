"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { LoaderCircle, MonitorIcon, SmartphoneIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { formatSessionDate, lastActiveLabel } from "./session-dates";

export interface SessionSummary {
  id: string;
  token: string;
  device: { label: string; isMobile: boolean }; // describeDevice, run on the server
  createdAt: Date;
  updatedAt: Date; // "last active"
  expiresAt: Date;
}

interface SessionListProps {
  sessions: SessionSummary[];
  currentSessionId: string;
}

const subscribe = () => () => {};

const SessionList = ({ sessions, currentSessionId }: SessionListProps) => {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Dates depend on the viewer's time zone, so only render them after mount.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const sorted = [...sessions].sort((a, b) => {
    if (a.id === currentSessionId) return -1;
    if (b.id === currentSessionId) return 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const signOut = async (session: SessionSummary) => {
    setPendingId(session.id);
    try {
      if (session.id === currentSessionId) {
        await authClient.signOut();
        router.push("/sign-in");
        router.refresh();
        return;
      }

      const result = await authClient.revokeSession({ token: session.token });

      if (result.error) {
        toast.error(result.error.message || "Could not sign out the session");
        return;
      }

      toast.success("Session signed out");
      router.refresh();
    } catch {
      toast.error("Could not sign out the session");
    } finally {
      setPendingId(null);
    }
  };

  if (sorted.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No sessions to show.</p>
    );
  }

  const now = new Date();

  return (
    <ul className="divide-y">
      {sorted.map((session) => {
        const { label, isMobile } = session.device;
        const isCurrent = session.id === currentSessionId;
        const DeviceIcon = isMobile ? SmartphoneIcon : MonitorIcon;
        const pending = pendingId === session.id;

        return (
          <li
            key={session.id}
            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <DeviceIcon className="text-muted-foreground size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium">{label}</span>
                {isCurrent && <Badge variant="secondary">This device</Badge>}
              </div>
              {mounted && (
                <p className="text-muted-foreground text-xs">
                  <span className="hidden sm:inline">
                    Signed in {formatSessionDate(session.createdAt)}
                    {" · "}
                  </span>
                  Last active{" "}
                  {lastActiveLabel(isCurrent ? now : session.updatedAt, now)}
                  <span className="hidden sm:inline">
                    {" · "}
                    Expires {formatSessionDate(session.expiresAt)}
                  </span>
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={pendingId !== null}
              aria-label={`Sign out ${label}${isCurrent ? " (this device)" : ""}`}
              onClick={() => signOut(session)}
            >
              {pending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                "Sign out"
              )}
            </Button>
          </li>
        );
      })}
    </ul>
  );
};

export default SessionList;
