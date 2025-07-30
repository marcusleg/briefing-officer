"use server";

import AddFeedFormDialogTrigger from "@/components/navigation/AddFeedFormDialogTrigger";
import AppSidebarMenuButton from "@/components/navigation/AppSidebarMenuButton";
import RefreshAllFeedsButton from "@/components/navigation/RefreshAllFeedsButton";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuBadge,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { NewspaperIcon, PlusIcon } from "lucide-react";

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
      <AddFeedFormDialogTrigger>
        <SidebarGroupAction title="Add Feed">
          <PlusIcon /> <span className="sr-only">Add Feed</span>
        </SidebarGroupAction>
      </AddFeedFormDialogTrigger>

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
          <RefreshAllFeedsButton />
        </SidebarMenuItem>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default FeedNavigation;
