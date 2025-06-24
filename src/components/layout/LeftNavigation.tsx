import UserNavigation from "@/components/layout/UserNavigation";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prismaClient";
import { headers } from "next/headers";
import AddFeedButton from "./AddFeedButton";
import FeedNavigation from "./FeedNavigation";
import LeftTopNavigation from "./LeftTopNavigation";
import RefreshAllFeedsButton from "./RefreshAllFeedsButton";

async function getFeedsForLeftNavigation() {
  return prisma.feed.findMany({
    include: {
      _count: {
        select: {
          articles: { where: { readAt: null } },
        },
      },
    },
    orderBy: { title: "asc" },
  });
}
type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
export type FeedsForLeftNavigation = ThenArg<
  ReturnType<typeof getFeedsForLeftNavigation>
>;

const LeftNavigation = async () => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  const feeds = await getFeedsForLeftNavigation();

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

      <Separator />

      <UserNavigation />
    </div>
  );
};

export default LeftNavigation;
