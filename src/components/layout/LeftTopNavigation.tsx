"use client";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  getNumberOfReadLaterArticles,
  getNumberOfUnreadArticles,
} from "@/lib/repository/statsRepository";
import { cn } from "@/lib/utils";
import { BookCheck, BookmarkIcon, HouseIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LeftTopNavigation = () => {
  const pathname = usePathname();

  const [numberOfUnreadArticles, setNumberOfUnreadArticles] =
    useState<number>();
  const [numberOfReadLaterArticles, setNumberOfReadLaterArticles] =
    useState<number>();

  useEffect(() => {
    getNumberOfReadLaterArticles().then((count) =>
      setNumberOfReadLaterArticles(count),
    );

    getNumberOfUnreadArticles().then((count) =>
      setNumberOfUnreadArticles(count),
    );
  }, [numberOfUnreadArticles, numberOfReadLaterArticles]);

  const links = [
    {
      href: "/",
      icon: HouseIcon,
      label: "Home",
      badge: numberOfUnreadArticles,
    },
    {
      href: "/read-later",
      icon: BookmarkIcon,
      label: "Read Later",
      badge: numberOfReadLaterArticles,
    },
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
          {link.badge && (
            <Badge className="ml-auto" variant="secondary">
              {link.badge}
            </Badge>
          )}
        </Link>
      ))}
    </>
  );
};

export default LeftTopNavigation;
