"use server";

import AdminNavigation from "@/components/navigation/AdminNavigation";
import ArticleSearch from "@/components/navigation/article-search";
import FeedNavigation from "@/components/navigation/FeedNavigation";
import MainNavigation from "@/components/navigation/MainNavigation";
import UserNavigation from "@/components/navigation/UserNavigation";
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
      <SidebarHeader>
        <Link href="/">
          <div className="flex items-center gap-2 px-2 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <NewspaperIcon className="h-4 w-4" />
            </div>
            <h1 className="text-sm font-semibold">Briefing Officer</h1>
          </div>
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
