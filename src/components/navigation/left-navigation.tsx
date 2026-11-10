"use server";

import AdminNavigation from "@/components/navigation/admin-navigation";
import ArticleSearch from "@/components/navigation/article-search";
import FeedNavigation from "@/components/navigation/feed-navigation";
import MainNavigation from "@/components/navigation/main-navigation";
import UserNavigation from "@/components/navigation/user-navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { NewspaperIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

const LeftNavigation = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  const isAdmin = session.user.role === "admin";

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <Link href="/" className="flex items-center gap-2.5 self-start">
          <span className="brand-mark size-8" aria-hidden="true">
            <NewspaperIcon className="size-[18px]" />
          </span>
          <h1 className="brand-rule py-[0.3em] text-lg leading-none font-bold">
            Briefing Officer
          </h1>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <ArticleSearch />
        </SidebarGroup>

        <MainNavigation />
        <FeedNavigation />
        {isAdmin && <AdminNavigation className="mt-auto" />}
      </SidebarContent>
      <SidebarFooter>
        <UserNavigation />
      </SidebarFooter>
    </Sidebar>
  );
};

export default LeftNavigation;
