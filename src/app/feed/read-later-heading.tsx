import { Separator } from "@/components/ui/separator";
import { BookmarkIcon } from "lucide-react";

const ReadLaterHeading = () => (
  <div className="mx-auto flex w-full max-w-4xl items-center gap-4 pt-4">
    <Separator className="flex-1" />
    <h3 className="text-muted-foreground flex items-center gap-2 font-semibold tracking-wide uppercase">
      <BookmarkIcon className="size-4" />
      Read Later
    </h3>
    <Separator className="flex-1" />
  </div>
);

export default ReadLaterHeading;
