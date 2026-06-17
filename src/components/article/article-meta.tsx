import { UserIcon } from "lucide-react";

interface ArticleMetaProps {
  author?: string | null;
}

const ArticleMeta = (props: ArticleMetaProps) => {
  if (!props.author) return null;

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <UserIcon className="size-4" />
        <span>{props.author}</span>
      </div>
    </div>
  );
};

export default ArticleMeta;
