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
      <SidebarHeader></SidebarHeader>
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
