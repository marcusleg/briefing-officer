"use server";

import AppSidebarMenuButton from "@/components/layout/AppSidebarMenuButton";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UsersIcon } from "lucide-react";

const AdminNavigation = async () => {
  const links = [
    {
      href: "/admin/user-management",
      icon: UsersIcon,
      label: "User Management",
    },
  ];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Administration</SidebarGroupLabel>
      <SidebarGroupContent>
        {links.map((link) => (
          <SidebarMenuItem key={link.href}>
            <AppSidebarMenuButton href={link.href}>
              <link.icon />
              <span>{link.label}</span>
            </AppSidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default AdminNavigation;
