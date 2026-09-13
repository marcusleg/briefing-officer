"use client";

import AddCategoryFormDialogTrigger from "@/components/category/add-category-form-dialog-trigger";
import AddFeedFormDialogTrigger from "@/components/navigation/add-feed-form-dialog-trigger";
import ImportOpmlDialogTrigger from "@/components/navigation/import-opml-dialog-trigger";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { DownloadIcon, PlusIcon, UploadIcon } from "lucide-react";

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
    <SidebarMenuItem>
      <ImportOpmlDialogTrigger>
        <SidebarMenuButton className="cursor-pointer">
          <UploadIcon />
          <span className="truncate">Import OPML</span>
        </SidebarMenuButton>
      </ImportOpmlDialogTrigger>
    </SidebarMenuItem>
    <SidebarMenuItem>
      {/* A plain link: the route handler sets Content-Disposition, so the
          browser downloads rather than navigates. No client state needed. */}
      <SidebarMenuButton asChild>
        <a href="/api/opml" download="briefing-officer.opml">
          <DownloadIcon />
          <span className="truncate">Export OPML</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </>
);

export default AddNavActions;
