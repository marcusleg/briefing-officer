import AddFeedFormDialogTrigger from "@/components/navigation/add-feed-form-dialog-trigger";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PlusIcon, RssIcon } from "lucide-react";

const NoFeedsMessage = () => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <RssIcon />
      </EmptyMedia>
      <EmptyTitle>No feeds added yet</EmptyTitle>
      <EmptyDescription>
        Get started by adding your first RSS feed to stay updated with your
        favorite news sources and blogs.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <AddFeedFormDialogTrigger>
        <Button className="cursor-pointer" variant="outline">
          <PlusIcon />
          Add Your First Feed
        </Button>
      </AddFeedFormDialogTrigger>

      <p className="text-muted-foreground text-xs">
        You can add feeds from news sites, blogs, and other RSS sources
      </p>
    </EmptyContent>
  </Empty>
);

export default NoFeedsMessage;
