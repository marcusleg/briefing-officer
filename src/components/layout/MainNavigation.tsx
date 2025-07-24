import AppSidebarMenuButton from "@/components/layout/AppSidebarMenuButton";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenuBadge,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  getNumberOfReadLaterArticles,
  getNumberOfUnreadArticles,
} from "@/lib/repository/statsRepository";
import { BookCheckIcon, BookmarkIcon, HouseIcon, StarIcon } from "lucide-react";

const MainNavigation = async () => {
  const numberOfUnreadArticles = await getNumberOfUnreadArticles();
  const numberOfReadLaterArticles = await getNumberOfReadLaterArticles();

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
    { href: "/read-history", icon: BookCheckIcon, label: "Read History" },
    { href: "/starred-articles", icon: StarIcon, label: "Starred Articles" },
  ];

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        {links.map((link) => (
          <SidebarMenuItem key={link.href}>
            <AppSidebarMenuButton href={link.href}>
              <link.icon />
              <span>{link.label}</span>
            </AppSidebarMenuButton>
            {link.badge && link.badge > 0 && (
              <SidebarMenuBadge>{link.badge}</SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default MainNavigation;
