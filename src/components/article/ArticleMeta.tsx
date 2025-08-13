import IntlRelativeTime from "@/components/IntlRelativeTime";
import { CalendarIcon, GlobeIcon, UserIcon } from "lucide-react";

interface ArticleMetaProps {
  feedTitle: string;
  author?: string | null;
  date: Date;
}

const ArticleMeta = (props: ArticleMetaProps) => {
  return (
    <div
      className={`flex flex-wrap items-center gap-4 text-sm text-muted-foreground ${props.className ?? ""}`}
    >
      <div className="flex items-center gap-1 font-medium">
        <GlobeIcon className="h-4 w-4" />
        <span>{props.feedTitle}</span>
      </div>
      {props.author && (
        <div className="flex items-center gap-1">
          <UserIcon className="h-4 w-4" />
          <span>{props.author}</span>
        </div>
      )}
      <div className="flex items-center gap-1">
        <CalendarIcon className="h-4 w-4" />
        <span>
          <IntlRelativeTime date={props.date} />
        </span>
      </div>
    </div>
  );
};

export default ArticleMeta;
