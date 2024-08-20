"use client";

import { useState } from "react";
import { addFeed } from "@/app/actions";

const AddFeed = () => {
  const [inputFeedUrl, setInputFeedUrl] = useState("");

  const handleAddFeed = () => addFeed(inputFeedUrl);

  return (
    <>
      Add feed:
      <input
        placeholder="Enter URL"
        onChange={(event) => setInputFeedUrl(event.target.value)}
      />
      <button onClick={handleAddFeed}>Add</button>
    </>
  );
};

export default AddFeed;
