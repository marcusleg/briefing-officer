"use server";

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
import {
  BookmarkIcon,
  HistoryIcon,
  NewspaperIcon,
  StarIcon,
} from "lucide-react";

const MainNavigation = async () => {
  const numberOfUnreadArticles = await getNumberOfUnreadArticles();
  const numberOfReadLaterArticles = await getNumberOfReadLaterArticles();

  const links = [
    {
      href: "/feed",
      icon: NewspaperIcon,
      label: "My Feed",
      badge: numberOfUnreadArticles,
    },
    {
      href: "/feed/read-later",
      icon: BookmarkIcon,
      label: "Read Later",
      badge: numberOfReadLaterArticles,
    },
    { href: "/feed/history", icon: HistoryIcon, label: "History" },
    {
      href: "/feed/starred-articles",
      icon: StarIcon,
      label: "Starred Articles",
    },
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
