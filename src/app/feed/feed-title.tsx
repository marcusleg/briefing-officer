import IntlRelativeTime from "@/components/intl-relative-time";

interface FeedTitleProps {
  title: string;
  articleCount: number;
  lastUpdated?: Date;
}

const FeedTitle = ({ title, articleCount, lastUpdated }: FeedTitleProps) => {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <span>{articleCount} articles</span>
        {lastUpdated && (
          <>
            <span>•</span>
            <span>
              Last updated <IntlRelativeTime date={lastUpdated} />
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default FeedTitle;
