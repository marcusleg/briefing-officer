"use server";

import AddCategoryButton from "@/components/category/AddCategoryButton";
import AddFeedFormDialogTrigger from "@/components/navigation/AddFeedFormDialogTrigger";
import AppSidebarMenuButton from "@/components/navigation/AppSidebarMenuButton";
import RefreshAllFeedsButton from "@/components/navigation/RefreshAllFeedsButton";
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

  const uncategorizedFeeds = await prisma.feed.findMany({
    include: {
      _count: {
        select: {
          articles: { where: { readAt: null, readLater: false } },
        },
      },
    },
    orderBy: { title: "asc" },
    where: { userId, feedCategoryId: null },
  });

  const categories = await prisma.feedCategory.findMany({
    where: { userId },
    include: {
      feeds: {
        include: {
          _count: {
            select: {
              articles: { where: { readAt: null, readLater: false } },
            },
          },
        },
        orderBy: { title: "asc" },
      },
    },
  });

  const menuItems = (
    feeds: Prisma.FeedGetPayload<{
      include: { _count: { select: { articles: true } } };
    }>[],
  ) =>
    feeds.map((feed) => (
      <SidebarMenuItem key={feed.id}>
        <AppSidebarMenuButton href={`/feed/${feed.id}`}>
          <NewspaperIcon />
          <span className="truncate">{feed.title}</span>
        </AppSidebarMenuButton>
        {feed._count.articles > 0 && (
          <SidebarMenuBadge>{feed._count.articles}</SidebarMenuBadge>
        )}
      </SidebarMenuItem>
    ));

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Uncategorized</SidebarGroupLabel>
      <AddFeedFormDialogTrigger>
        <SidebarGroupAction title="Add Feed">
          <PlusIcon /> <span className="sr-only">Add Feed</span>
        </SidebarGroupAction>
      </AddFeedFormDialogTrigger>
      <SidebarGroupContent>{menuItems(uncategorizedFeeds)}</SidebarGroupContent>
      <SidebarGroupContent>
        {categories.map((category) => (
          <React.Fragment key={category.id}>
            <SidebarGroupLabel>{category.name}</SidebarGroupLabel>
            {menuItems(category.feeds)}
          </React.Fragment>
        ))}
      </SidebarGroupContent>
      <SidebarGroupContent>
        <SidebarSeparator />
        <SidebarMenuItem>
          <AddCategoryButton />
        </SidebarMenuItem>
        <SidebarMenuItem>
          <RefreshAllFeedsButton />
        </SidebarMenuItem>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default FeedNavigation;
