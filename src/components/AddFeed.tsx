"use client";

import { useState } from "react";
import { addFeed } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AddFeed = () => {
  const [inputFeedUrl, setInputFeedUrl] = useState("");

  const handleAddFeed = () => addFeed(inputFeedUrl);

  return (
    <>
      <h2 className="scroll-m-20 text-xl font-semibold tracking-tight">
        Add feed
      </h2>
      <Input
        type="url"
        placeholder="Enter URL"
        onChange={(event) => setInputFeedUrl(event.target.value)}
      />
      <Button variant="secondary" className="w-full" onClick={handleAddFeed}>
        Add
      </Button>
    </>
  );
};

export default AddFeed;
