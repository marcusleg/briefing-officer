"use client";

import ImportOpmlDialog from "@/components/navigation/import-opml-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import {
  ChevronUpIcon,
  DownloadIcon,
  LogOutIcon,
  UploadIcon,
  User2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface UserDropdownMenuProps {
  userName: string;
}

const UserDropdownMenu = ({ userName }: UserDropdownMenuProps) => {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);

  const handleSignOut = () => {
    authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <>
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
          {/* Moving feeds in or out is a once-per-account affair, so it lives
              with the account rather than taking permanent rows in the feed
              list. */}
          <DropdownMenuItem
            onSelect={() => setImportOpen(true)}
            className="cursor-pointer"
          >
            <UploadIcon />
            <span>Import OPML</span>
          </DropdownMenuItem>
          {/* A plain link: the route handler sets Content-Disposition, so the
              browser downloads rather than navigates. */}
          <DropdownMenuItem asChild className="cursor-pointer">
            <a href="/api/opml" download="briefing-officer.opml">
              <DownloadIcon />
              <span>Export OPML</span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
            <LogOutIcon />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ImportOpmlDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
};

export default UserDropdownMenu;
