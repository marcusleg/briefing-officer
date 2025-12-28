"use server";

import AddCategoryFormDialogTrigger from "@/components/category/add-category-form-dialog-trigger";
import AddFeedFormDialogTrigger from "@/components/navigation/add-feed-form-dialog-trigger";
import AppSidebarMenuButton from "@/components/navigation/app-sidebar-menu-button";
import { Badge } from "@/components/ui/badge";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import prisma from "@/lib/prismaClient";
import { getUserId } from "@/lib/repository/userRepository";
import { NewspaperIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Prisma } from "../../../prisma/generated/prisma/client";

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
          <span className="grow truncate">{feed.title}</span>
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
        <SidebarMenuItem>
          <AddCategoryFormDialogTrigger>
            <SidebarMenuButton className="cursor-pointer">
              <PlusIcon />
              <span className="truncate">Add Category</span>
            </SidebarMenuButton>
          </AddCategoryFormDialogTrigger>
        </SidebarMenuItem>
        <AddFeedFormDialogTrigger>
          <SidebarMenuItem>
            <SidebarMenuButton className="cursor-pointer">
              <PlusIcon />
              <span className="truncate">Add Feed</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </AddFeedFormDialogTrigger>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default FeedNavigation;
