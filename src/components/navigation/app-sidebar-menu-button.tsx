"use client";

import { SidebarMenuButton } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

interface AppSidebarMenuButtonProps {
  href: string;
  children: React.ReactNode;
}

const AppSidebarMenuButton = ({
  href,
  children,
}: AppSidebarMenuButtonProps) => {
  const pathname = usePathname();

  return (
    <SidebarMenuButton asChild isActive={pathname === href}>
      <a href={href}>{children}</a>
    </SidebarMenuButton>
  );
};

export default AppSidebarMenuButton;
