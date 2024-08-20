import prisma from "@/lib/prismaClient";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Sparkles, Speech } from "lucide-react";
import { getReadability } from "@/app/feed/[feedId]/[articleId]/reader-view/actions";

const ReaderView = async ({
  params,
}: {
  params: { feedId: string; articleId: string };
}) => {
  const article = await prisma.article.findUniqueOrThrow({
    where: {
      id: parseInt(params.articleId),
    },
  });

  const readerDocument = await getReadability(article.id, article.link);

  return (
    <div className="m-2 max-w-4xl flex flex-col gap-2">
      <div className="flex flex-row gap-2">
        <BackButton />
        <Button>
          <Sparkles className="mr-2 h-4 w-4" />
          AI Summary
        </Button>
        <Button>
          <Speech className="mr-2 h-4 w-4" />
          Read aloud
        </Button>
      </div>

      <article>
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
          {readerDocument?.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {readerDocument?.byline}
        </p>
        <p
          className="text-justify text-pretty hyphens-auto reader-view"
          dangerouslySetInnerHTML={{ __html: readerDocument?.content }}
        ></p>
      </article>
    </div>
  );
};

export default ReaderView;
