import LeftNavigationLink from "@/components/layout/LeftNavigationLink";
import { Badge } from "@/components/ui/badge";
import {
  getNumberOfReadLaterArticles,
  getNumberOfUnreadArticles,
} from "@/lib/repository/statsRepository";
import { BookCheck, BookmarkIcon, HouseIcon, StarIcon } from "lucide-react";

const LeftTopNavigation = async () => {
  const numberOfUnreadArticles = await getNumberOfUnreadArticles();
  const numberOfReadLaterArticles = await getNumberOfReadLaterArticles();

  const getBadgeValue = (count: number | undefined) => {
    if (count === undefined) {
      return undefined;
    }
    if (count === 0) {
      return undefined;
    }
    return `${count}`;
  };

  const links = [
    {
      href: "/",
      icon: HouseIcon,
      label: "Home",
      badge: getBadgeValue(numberOfUnreadArticles),
    },
    {
      href: "/read-later",
      icon: BookmarkIcon,
      label: "Read Later",
      badge: getBadgeValue(numberOfReadLaterArticles),
    },
    { href: "/read-history", icon: BookCheck, label: "Read History" },
    { href: "/starred-articles", icon: StarIcon, label: "Starred Articles" },
  ];

  return (
    <>
      {links.map((link) => (
        <LeftNavigationLink key={link.href} href={link.href} badge={link.badge}>
          <link.icon className="mr-2 h-4 w-4" /> {link.label}
          {link.badge && (
            <Badge className="ml-auto" variant="secondary">
              {link.badge}
            </Badge>
          )}
        </LeftNavigationLink>
      ))}
    </>
  );
};

export default LeftTopNavigation;
