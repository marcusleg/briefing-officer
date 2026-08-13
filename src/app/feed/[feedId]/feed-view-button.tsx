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
import { ChevronDownIcon, Filter } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const FeedViewButton = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const searchParams = useSearchParams();

  const currentFilter = searchParams.get("show") || "unread";

  return (
    <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
      <DropdownMenuTrigger asChild>
        <Button className="cursor-pointer" variant="outline">
          <Filter className="mr-2 size-4" />
          View
          {isOpen ? (
            <ChevronDownIcon className="ml-2 size-4 rotate-180 transition-transform" />
          ) : (
            <ChevronDownIcon className="ml-2 size-4 transition-transform" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Show articles</DropdownMenuLabel>
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
          <DropdownMenuRadioItem
            value="rejected"
            onClick={() => router.push(`?show=rejected`)}
          >
            Not interested
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default FeedViewButton;
