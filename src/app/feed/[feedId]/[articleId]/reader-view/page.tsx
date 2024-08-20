import prisma from "@/lib/prismaClient";
import axios from "axios";
import DOMPurify from "isomorphic-dompurify";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import BackButton from "@/components/BackButton";

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

  const website = await axios.get(article.link);
  const cleanBody = DOMPurify.sanitize(website.data);
  const document = new JSDOM(cleanBody);
  const readerDocument = new Readability(document.window.document).parse();

  return (
    <div className="m-2 max-w-4xl flex flex-col gap-2">
      <div>
        <BackButton />
      </div>

      <article>
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
          {readerDocument?.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {readerDocument?.byline}
        </p>
        <p
          className="text-justify text-pretty hyphens-auto"
          dangerouslySetInnerHTML={{ __html: readerDocument?.content }}
        ></p>
      </article>
    </div>
  );
};

export default ReaderView;
