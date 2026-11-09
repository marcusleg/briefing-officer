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
        {/* The app name over the gradient rule. */}
        <Link href="/" className="brand-rule self-start py-[0.3em]">
          <h1 className="text-lg leading-none font-bold">Briefing Officer</h1>
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
