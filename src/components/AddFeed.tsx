"use client";

import { useState } from "react";
import { addFeed } from "@/app/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

const AddFeed = () => {
  const [inputFeedUrl, setInputFeedUrl] = useState("");

  const handleAddFeed = () => addFeed(inputFeedUrl);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full" size="sm" variant="ghost">
          <Plus className="mr-2 h-4 w-4" />
          Add feed
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add a new feed</DialogTitle>
          <DialogDescription>
            Enter a URL of an RSS or Atom feed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="url">URL</Label>
            <Input
              defaultValue={inputFeedUrl}
              id="url"
              onChange={(event) => setInputFeedUrl(event.target.value)}
              placeholder="http://example.com/rss"
              type="url"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleAddFeed}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddFeed;
