"use client";

import AddCategoryFormDialogTrigger from "@/components/category/add-category-form-dialog-trigger";
import AddFeedFormDialogTrigger from "@/components/navigation/add-feed-form-dialog-trigger";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { PlusIcon } from "lucide-react";

const AddNavActions = () => (
  <>
    <SidebarMenuItem>
      <AddCategoryFormDialogTrigger>
        <SidebarMenuButton className="cursor-pointer">
          <PlusIcon />
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
