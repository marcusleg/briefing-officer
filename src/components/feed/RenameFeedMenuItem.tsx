"use client";

import { renameFeed } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { useState } from "react";

interface RenameFeedMenuItemProps {
  currentFeedTitle: string;
  feedId: number;
}

const RenameFeedMenuItem = ({
  currentFeedTitle,
  feedId,
}: RenameFeedMenuItemProps) => {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newFeedTitle, setNewFeedTitle] = useState(currentFeedTitle);
  const [renamingInProgress, setRenamingInProgress] = useState(false);

  const handleSubmit = async () => {
    setRenamingInProgress(true);
    await renameFeed(feedId, newFeedTitle);
    setRenamingInProgress(false);
    setRenameDialogOpen(false);
  };

  return (
    <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Pencil className="mr-2 h-4 w-4" />
          <span>Rename</span>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename feed</DialogTitle>
          <DialogDescription>
            Change the display name of this feed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="link" className="sr-only">
              Link
            </Label>
            <Input
              defaultValue={newFeedTitle}
              disabled={renamingInProgress}
              onChange={(event) => setNewFeedTitle(event.target.value)}
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
            disabled={renamingInProgress}
            onClick={handleSubmit}
            type="button"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RenameFeedMenuItem;
