import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Feed } from "@/generated/prisma/client";
import { ShieldCheckIcon } from "lucide-react";

interface NoRejectedArticlesProps {
  feed: Feed;
}

const NoRejectedArticles = ({ feed }: NoRejectedArticlesProps) => {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldCheckIcon />
        </EmptyMedia>
        <EmptyTitle>Nothing filtered out</EmptyTitle>
        <EmptyDescription>
          No {feed.title} articles have been filtered or marked as not
          interesting.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

export default NoRejectedArticles;
