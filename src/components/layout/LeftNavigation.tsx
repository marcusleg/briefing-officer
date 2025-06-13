import { Separator } from "@/components/ui/separator";
import prisma from "@/lib/prismaClient";
import AddFeedButton from "./AddFeedButton";
import FeedNavigation from "./FeedNavigation";
import LeftTopNavigation from "./LeftTopNavigation";
import RefreshAllFeedsButton from "./RefreshAllFeedsButton";

const LeftNavigation = async () => {
  const feeds = await prisma.feed.findMany({
    include: {
      _count: {
        select: {
          articles: { where: { readAt: null } },
        },
      },
    },
    orderBy: { title: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-row flex-wrap justify-evenly gap-2 md:flex-col md:flex-nowrap">
        <LeftTopNavigation />

        <Separator />

        <FeedNavigation feeds={feeds} />
      </nav>

      <Separator className="md:hidden" orientation="vertical" />

      <div className="flex flex-row justify-center gap-2 px-2">
        <AddFeedButton />
        <RefreshAllFeedsButton />
      </div>
    </div>
  );
};

export default LeftNavigation;
