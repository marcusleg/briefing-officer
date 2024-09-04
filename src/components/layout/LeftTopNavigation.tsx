"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookCheck, BookmarkIcon, HouseIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LeftTopNavigation = () => {
  const pathname = usePathname();

  const links = [
    { href: "/", icon: HouseIcon, label: "Home" },
    { href: "/read-later", icon: BookmarkIcon, label: "Read Later" },
    { href: "/read-history", icon: BookCheck, label: "Read History" },
    { href: "/starred-articles", icon: StarIcon, label: "Starred Articles" },
  ];

  return (
    <>
      {links.map((link) => (
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
          <link.icon className="mr-2 h-4 w-4" />
          {link.label}
        </Link>
      ))}
    </>
  );
};

export default LeftTopNavigation;
