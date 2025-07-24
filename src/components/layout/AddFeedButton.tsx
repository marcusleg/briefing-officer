"use client";

import FeedForm from "@/components/feed/FeedForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

const AddFeedButton = () => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <SidebarMenuButton>
          <PlusIcon />
          <span className="truncate">Add Feed</span>
        </SidebarMenuButton>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a new feed</DialogTitle>
          <DialogDescription>
            Enter a URL of an RSS or Atom feed.
          </DialogDescription>
        </DialogHeader>
        <FeedForm onSubmitComplete={() => setDialogOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};

export default AddFeedButton;
