"use server";

import FeedNavigation from "@/components/layout/FeedNavigation";
import MainNavigation from "@/components/layout/MainNavigation";
import UserNavigation from "@/components/layout/UserNavigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { NewspaperIcon } from "lucide-react";
import { headers } from "next/headers";

const LeftNavigation = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <NewspaperIcon className="h-4 w-4" />
          </div>
          <h1 className="text-sm font-semibold">Briefing Officer</h1>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <MainNavigation />
        <FeedNavigation />
      </SidebarContent>
      <SidebarFooter>
        <UserNavigation />
      </SidebarFooter>
    </Sidebar>
  );
};

export default LeftNavigation;
