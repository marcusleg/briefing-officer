"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { ChevronUpIcon, LogOutIcon, User2Icon } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserDropdownMenuProps {
  userName: string;
}

const UserDropdownMenu = ({ userName }: UserDropdownMenuProps) => {
  const router = useRouter();
  const handleSignOut = () => {
    authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="cursor-pointer">
          <User2Icon /> {userName}
          <ChevronUpIcon className="ml-auto" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        className="w-(--radix-popper-anchor-width)"
      >
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <LogOutIcon />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserDropdownMenu;
