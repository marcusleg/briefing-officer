"use client";

import { WifiOffIcon } from "lucide-react";
import { useOffline } from "next/offline";

/**
 * Tells the reader their changes are waiting for a connection rather than
 * lost. Next detects the outage, from the browser or from a request that could
 * not reach the server, and holds those requests until it is over.
 */
const OfflineBanner = () => {
  const isOffline = useOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <div
      className="bg-muted text-muted-foreground sticky top-0 z-20 flex items-center justify-center gap-2 border-b px-4 py-2 text-sm"
      role="status"
    >
      <WifiOffIcon className="size-4 shrink-0" />
      You&apos;re offline. Your changes will be saved when you&apos;re back
      online.
    </div>
  );
};

export default OfflineBanner;
