"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "../ui/button";

interface LeftNavigationLinkProps {
  href: string;
  children: React.ReactNode;
  badge?: string;
}

const LeftNavigationLink = (link: LeftNavigationLinkProps) => {
  const pathname = usePathname();

  return (
    <Link
      key={link.href}
      href={link.href}
      className={cn(
        pathname === link.href
          ? buttonVariants({ variant: "default", size: "sm" })
          : buttonVariants({ variant: "ghost", size: "sm" }),
        "max-w-52 justify-start font-bold",
      )}
    >
      {link.children}
    </Link>
  );
};

export default LeftNavigationLink;
