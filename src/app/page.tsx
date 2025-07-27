import ArticleList from "@/components/article/ArticleList";
import Dashboard from "@/components/frontpage/Dashboard";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Typography from "@/components/ui/typography";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";

const Home = async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  const articles = await prisma.article.findMany({
    include: {
      feed: true,
      scrape: true,
      user: true,
    },
    where: {
      readAt: null,
      readLater: false,
      userId: session.user.id,
    },
    orderBy: {
      publicationDate: "desc",
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbPage>Home</BreadcrumbPage>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <Dashboard />

      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">
          Unread articles from your feeds
        </h2>
        <Badge variant="secondary" className="text-sm">
          {articles.length} articles
        </Badge>
      </div>

      <Separator />

      {articles.length > 0 ? (
        <ArticleList articles={articles} />
      ) : (
        <Typography
          variant="p"
          className="my-8 text-center text-lg text-muted-foreground"
        >
          There are no unread articles.
        </Typography>
      )}
    </div>
  );
};

export default Home;
