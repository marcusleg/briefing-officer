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
import { useState } from "react";

interface AddFeedFormTriggerProps {
  children: React.ReactNode;
}

const AddFeedFormDialogTrigger = ({ children }: AddFeedFormTriggerProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

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

export default AddFeedFormDialogTrigger;
