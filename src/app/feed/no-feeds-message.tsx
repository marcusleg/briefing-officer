import AddFeedFormDialogTrigger from "@/components/navigation/AddFeedFormDialogTrigger";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Rss } from "lucide-react";

const NoFeedsMessage = () => (
  <div className="mx-auto flex min-h-[400px] items-center justify-center p-6">
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Rss className="h-8 w-8 text-muted-foreground" />
        </div>

        <h2 className="mb-2 text-xl font-semibold">No feeds added yet</h2>

        <p className="mb-6 leading-relaxed text-muted-foreground">
          Get started by adding your first RSS feed to stay updated with your
          favorite news sources and blogs.
        </p>

        <AddFeedFormDialogTrigger>
          <Button className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Feed
          </Button>
        </AddFeedFormDialogTrigger>

        <p className="mt-4 text-xs text-muted-foreground">
          You can add feeds from news sites, blogs, and other RSS sources
        </p>
      </CardContent>
    </Card>
  </div>
);

export default NoFeedsMessage;
