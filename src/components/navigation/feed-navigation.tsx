"use server";

import AddNavActions from "@/components/navigation/add-nav-actions";
import AppSidebarMenuButton from "@/components/navigation/app-sidebar-menu-button";
import { Badge } from "@/components/ui/badge";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { NewspaperIcon, PauseIcon } from "lucide-react";
import Link from "next/link";
import React from "react";

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
          {feed.autoRefresh ? <NewspaperIcon /> : <PauseIcon />}
          <span
            className={`grow truncate ${feed.autoRefresh ? "" : "text-muted-foreground"}`}
          >
            {feed.title}
            {!feed.autoRefresh && <span className="sr-only"> (paused)</span>}
          </span>
          {feed._count.articles > 0 && (
            <Badge variant="secondary">{feed._count.articles}</Badge>
          )}
        </AppSidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <SidebarGroup>
      {uncategorizedFeeds.length > 0 && (
        <>
          <SidebarGroupLabel>Uncategorized</SidebarGroupLabel>
          <SidebarGroupContent>
            {menuItems(uncategorizedFeeds)}
          </SidebarGroupContent>
        </>
      )}

      <SidebarGroupContent>
        {categories.map((category) => (
          <React.Fragment key={category.id}>
            <SidebarGroupLabel asChild>
              <Link href={`/feed/category/${category.id}`}>
                {category.name}
              </Link>
            </SidebarGroupLabel>
            {menuItems(category.feeds)}
          </React.Fragment>
        ))}
      </SidebarGroupContent>

      <SidebarSeparator />

      <SidebarGroupContent>
        <AddNavActions />
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default FeedNavigation;
