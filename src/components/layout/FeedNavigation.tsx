"use server";

import AddFeedButton from "@/components/layout/AddFeedButton";
import AppSidebarMenuButton from "@/components/layout/AppSidebarMenuButton";
import RefreshAllFeedsButton from "@/components/layout/RefreshAllFeedsButton";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuBadge,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { NewspaperIcon } from "lucide-react";

const FeedNavigation = async () => {
  const userId = await getUserId();

  const feeds = await prisma.feed.findMany({
    include: {
      _count: {
        select: {
          articles: { where: { readAt: null, readLater: false } },
        },
      },
    },
    orderBy: { title: "asc" },
    where: { userId },
  });

  return (
    <SidebarGroup>
      <SidebarGroupLabel>My Feeds</SidebarGroupLabel>
      <SidebarGroupContent>
        {feeds.map((feed) => (
          <SidebarMenuItem key={feed.id}>
            <AppSidebarMenuButton href={`/feed/${feed.id}`}>
              <NewspaperIcon />
              <span className="truncate">{feed.title}</span>
            </AppSidebarMenuButton>
            {feed._count.articles > 0 && (
              <SidebarMenuBadge>{feed._count.articles}</SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        ))}
        <SidebarSeparator />
        <SidebarMenuItem>
          <AddFeedButton />
        </SidebarMenuItem>
        <SidebarMenuItem>
          <RefreshAllFeedsButton />
        </SidebarMenuItem>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default FeedNavigation;
