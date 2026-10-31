"use client";

import { SidebarMenuButton } from "@/components/ui/sidebar";
import Link from "next/link";
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
      {/* A client-side link, so a tap while offline waits for the connection
          instead of loading a browser error page and losing unsaved changes. */}
      <Link href={href}>{children}</Link>
    </SidebarMenuButton>
  );
};

export default AppSidebarMenuButton;
