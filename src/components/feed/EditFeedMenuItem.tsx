"use client";

import { editFeed } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Feed } from "@prisma/client";
import { Pencil } from "lucide-react";
import { useState } from "react";

interface RenameFeedMenuItemProps {
  feed: Feed;
}

const EditFeedMenuItem = ({ feed }: RenameFeedMenuItemProps) => {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [editInProgress, setEditInProgress] = useState(false);

  const [newFeedTitle, setNewFeedTitle] = useState(feed.title);
  const [newFeedUrl, setNewFeedUrl] = useState(feed.link);

  const handleSubmit = async () => {
    setEditInProgress(true);
    await editFeed(feed.id, newFeedTitle, newFeedUrl);
    setEditInProgress(false);
    setRenameDialogOpen(false);
  };

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
        <div className="flex flex-col gap-2">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              defaultValue={newFeedTitle}
              disabled={editInProgress}
              id="title"
              onChange={(event) => setNewFeedTitle(event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="link">Feed URL</Label>
            <Input
              defaultValue={newFeedUrl}
              disabled={editInProgress}
              id="link"
              onChange={(event) => setNewFeedUrl(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={editInProgress}
            onClick={handleSubmit}
            type="button"
          >
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditFeedMenuItem;
