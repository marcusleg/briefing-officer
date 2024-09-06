"use client";

import { addFeed } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface FeedFormProps {
  onSubmitComplete: () => void;
}

const FeedForm = ({ onSubmitComplete }: FeedFormProps) => {
  const [inputFeedUrl, setInputFeedUrl] = useState("");

  const handleAddFeed = async () => {
    await addFeed(inputFeedUrl);
    onSubmitComplete();
  };

  return (
    <>
      <div className="grid gap-4 py-4">
        <div className="flex items-center gap-4">
          <Label htmlFor="url">URL</Label>
          <Input
            defaultValue={inputFeedUrl}
            id="url"
            onChange={(event) => setInputFeedUrl(event.target.value)}
            placeholder="https://example.com/rss"
            type="url"
          />
        </div>
      </div>
      <div className="flex flex-row flex-nowrap justify-end gap-2">
        <Button type="button" variant="secondary">
          Cancel
        </Button>
        <Button type="button" onClick={handleAddFeed}>
          Add
        </Button>
      </div>
    </>
  );
};

export default FeedForm;
