"use client";

import FeedForm from "@/components/feed/FeedForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Feed } from "@prisma/client";
import { Pencil } from "lucide-react";
import { useState } from "react";

interface RenameFeedMenuItemProps {
  feed: Feed;
}

const EditFeedMenuItem = ({ feed }: RenameFeedMenuItemProps) => {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);

  return (
    <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Pencil className="mr-2 h-4 w-4" />
          <span>Edit</span>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit feed</DialogTitle>
        </DialogHeader>

        <FeedForm
          editFeed={feed}
          onSubmitComplete={() => setRenameDialogOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default EditFeedMenuItem;
