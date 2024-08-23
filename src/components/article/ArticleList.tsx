import ArticleCard from "@/components/article/ArticleCard";
import { Prisma } from "@prisma/client";

interface ArticleListProps {
  articles: Prisma.ArticleGetPayload<{ include: { aiSummary: true } }>[];
}

const ArticleList = ({ articles }: ArticleListProps) => {
  return (
    <div className="flex flex-col gap-4">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
};

export default ArticleList;
