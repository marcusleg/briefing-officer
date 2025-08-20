interface FeedTitleProps {
  title: string;
  articleCount: number;
}

const FeedTitle = ({ title, articleCount }: FeedTitleProps) => {
  return (
    <>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{articleCount} articles</p>
    </>
  );
};

export default FeedTitle;
