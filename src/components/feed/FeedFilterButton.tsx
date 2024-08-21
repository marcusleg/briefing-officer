"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

const FeedFilterButton = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentFilter = searchParams.get("show") || "unread";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Filter articles</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={currentFilter}>
          <DropdownMenuRadioItem
            value="all"
            onClick={() => router.push(`?show=all`)}
          >
            All articles
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="unread"
            onClick={() => router.push(`?show=unread`)}
          >
            Unread only
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default FeedFilterButton;
