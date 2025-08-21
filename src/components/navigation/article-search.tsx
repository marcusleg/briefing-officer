"use client";

import { Button } from "@/components/ui/button";
import { SidebarInput } from "@/components/ui/sidebar";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ArticleSearch = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSubmit = () => {
    router.push(`/feed/search?q=${searchQuery}`);
  };

  return (
    <div className="px-2 py-2">
      <div className="relative">
        <SidebarInput
          placeholder="Search articles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="pr-10"
          autoFocus={false}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSubmit}
          className="hover:bg-muted absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 p-0"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ArticleSearch;
