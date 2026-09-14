"use client";

import AddCategoryFormDialogTrigger from "@/components/category/add-category-form-dialog-trigger";
import AddFeedFormDialogTrigger from "@/components/navigation/add-feed-form-dialog-trigger";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { FolderPlusIcon, PlusIcon } from "lucide-react";

// Only the everyday actions live here. Import and export of OPML sit in the
// user menu at the bottom of the sidebar (user-dropdown-menu.tsx), so the feed
// list ends with two rows instead of a stack of management commands.
const AddNavActions = () => (
  <>
    <SidebarMenuItem>
      <AddCategoryFormDialogTrigger>
        <SidebarMenuButton className="cursor-pointer">
          <FolderPlusIcon />
          <span className="truncate">Add Category</span>
        </SidebarMenuButton>
      </AddCategoryFormDialogTrigger>
    </SidebarMenuItem>
    <SidebarMenuItem>
      <AddFeedFormDialogTrigger>
        <SidebarMenuButton className="cursor-pointer">
          <PlusIcon />
          <span className="truncate">Add Feed</span>
        </SidebarMenuButton>
      </AddFeedFormDialogTrigger>
    </SidebarMenuItem>
  </>
);

export default AddNavActions;
