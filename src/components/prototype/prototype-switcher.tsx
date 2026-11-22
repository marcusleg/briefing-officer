"use client";

// PROTOTYPE (chat-based summary spike): cycles a page's `?variant=` with the
// arrows or the arrow keys. Never rendered in production builds.

import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.closest("input, textarea, [contenteditable]") !== null ||
    target.isContentEditable);

const PrototypeSwitcher = ({
  variants,
  current,
}: {
  variants: { key: string; name: string }[];
  current: string;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const index = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current),
  );

  const go = useCallback(
    (step: number) => {
      const next = variants[(index + step + variants.length) % variants.length];
      const params = new URLSearchParams(searchParams);
      params.set("variant", next.key);
      router.replace(`${pathname}?${params}`);
    },
    [index, pathname, router, searchParams, variants],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="bg-foreground text-background fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full px-1 py-1 text-sm shadow-lg">
      <Button
        size="icon"
        variant="ghost"
        className="hover:bg-background/20 hover:text-background rounded-full"
        aria-label="Previous variant"
        onClick={() => go(-1)}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="px-2 font-medium whitespace-nowrap">
        {variants[index].key} · {variants[index].name}
      </span>
      <Button
        size="icon"
        variant="ghost"
        className="hover:bg-background/20 hover:text-background rounded-full"
        aria-label="Next variant"
        onClick={() => go(1)}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
};

export default PrototypeSwitcher;
