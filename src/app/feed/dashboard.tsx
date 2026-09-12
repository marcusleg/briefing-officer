"use client";

import StackedFeedBarChart from "@/app/feed/stacked-feed-bar-chart";
import TokenUsageChart, { TokenUsageData } from "@/app/feed/token-usage-chart";
import UnreadArticlesPieChart, {
  UnreadArticlesChartData,
} from "@/app/feed/unread-articles-pie-chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildFeedPalette } from "@/lib/charts/palette";
import {
  getChartFeeds,
  getFilteredArticlesPerDay,
  getTokenUsageHistory,
  getUnreadArticlesPerFeed,
  getWeeklyArticleCountPerFeed,
  getWeeklyArticlesRead,
} from "@/lib/repository/statsRepository";
import { ArticlesPerFeedData } from "@/lib/repository/statsTransforms";
import { useEffect, useMemo, useState } from "react";

export enum DateRangePreset {
  Last7Days = "Last 7 Days",
  Last30Days = "Last 30 Days",
  Last3Months = "Last 3 Months",
}

interface DateRange {
  from: Date;
  to: Date;
}

const getDateRangeFromPreset = (preset: DateRangePreset): DateRange => {
  const to = new Date();
  const from = new Date();

  switch (preset) {
    case DateRangePreset.Last7Days:
      from.setDate(to.getDate() - 7);
      break;
    case DateRangePreset.Last30Days:
      from.setDate(to.getDate() - 30);
      break;
    case DateRangePreset.Last3Months:
      from.setMonth(to.getMonth() - 3);
      break;
  }

  return { from, to };
};

const Dashboard = () => {
  const isMobile = useIsMobile();

  const [selectedRange, setSelectedRange] = useState<DateRangePreset>(
    DateRangePreset.Last7Days,
  );

  const [feeds, setFeeds] = useState<{ id: number; title: string }[]>();
  const [unreadArticlesChartData, setUnreadArticlesChartData] =
    useState<UnreadArticlesChartData[]>();
  const [tokenUsageData, setTokenUsageData] = useState<TokenUsageData>();
  const [dailyNewArticlesData, setDailyNewArticlesData] =
    useState<ArticlesPerFeedData>();
  const [dailyActivityData, setDailyActivityData] =
    useState<ArticlesPerFeedData>();
  const [dailyFilteredArticlesData, setDailyFilteredArticlesData] =
    useState<ArticlesPerFeedData>();

  // Neither the feed list nor the unread breakdown depends on the selected
  // range — the breakdown is a snapshot of right now — so they must not be
  // refetched when it changes.
  useEffect(() => {
    getChartFeeds().then((data) => setFeeds(data));
    getUnreadArticlesPerFeed().then((data) => setUnreadArticlesChartData(data));
  }, []);

  // One color per feed for the whole row of charts. Deriving it per chart from
  // that chart's own series would give the same feed a different color in each
  // of them, since a feed with no rows drops out of one chart's series but not
  // another's.
  const feedConfig = useMemo(() => buildFeedPalette(feeds ?? []), [feeds]);

  // Holds a per-feed chart on its skeleton until the palette is there, so a
  // chart never renders a feed the config has no color for.
  const oncePaletted = (data?: ArticlesPerFeedData) =>
    feeds ? data : undefined;

  useEffect(() => {
    const dateRange = getDateRangeFromPreset(selectedRange);

    getTokenUsageHistory(dateRange.from, dateRange.to).then((data) =>
      setTokenUsageData(data),
    );

    getWeeklyArticleCountPerFeed(dateRange.from, dateRange.to).then((data) =>
      setDailyNewArticlesData(data),
    );

    getWeeklyArticlesRead(dateRange.from, dateRange.to).then((data) =>
      setDailyActivityData(data),
    );

    getFilteredArticlesPerDay(dateRange.from, dateRange.to).then((data) =>
      setDailyFilteredArticlesData(data),
    );
  }, [selectedRange]);

  return (
    <>
      {!isMobile && (
        <ToggleGroup
          className="mx-auto"
          onValueChange={(value) => setSelectedRange(value as DateRangePreset)}
          type="single"
          value={selectedRange}
          variant="outline"
        >
          {Object.values(DateRangePreset).map((range) => (
            <ToggleGroupItem key={range} value={range}>
              {range}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {/*
        Five charts across two breakpoints: a six-column grid fits three per row
        (`col-span-2` each), and starting the fourth card at column 2 centers the
        two-card second row instead of leaving it hanging on the left. From 2xl
        the row is wide enough to hold all five side by side.
      */}
      <div className="mx-auto hidden w-full max-w-7xl grid-cols-1 gap-4 md:grid md:grid-cols-6 2xl:max-w-[96rem] 2xl:grid-cols-5">
        <div className="md:col-span-2 2xl:col-span-1 [&>*]:h-full">
          <UnreadArticlesPieChart
            config={feedConfig}
            chartData={feeds && unreadArticlesChartData}
          />
        </div>
        <div className="md:col-span-2 2xl:col-span-1 [&>*]:h-full">
          <TokenUsageChart data={tokenUsageData} />
        </div>
        <div className="md:col-span-2 2xl:col-span-1 [&>*]:h-full">
          <StackedFeedBarChart
            title="Daily New Articles"
            description="Number of new articles that appeared in your feed each day, split by the feed they came from"
            config={feedConfig}
            data={oncePaletted(dailyNewArticlesData)}
          />
        </div>
        <div className="md:col-span-2 md:col-start-2 2xl:col-span-1 2xl:col-start-auto [&>*]:h-full">
          <StackedFeedBarChart
            title="Your Daily Activity"
            description="Number of articles you read each day, split by the feed they came from"
            config={feedConfig}
            data={oncePaletted(dailyActivityData)}
          />
        </div>
        <div className="md:col-span-2 2xl:col-span-1 [&>*]:h-full">
          <StackedFeedBarChart
            title="Filtered Articles"
            description="Number of articles that never reached you each day, filtered by your keywords or rejected by hand, split by the feed they came from"
            config={feedConfig}
            data={oncePaletted(dailyFilteredArticlesData)}
          />
        </div>
      </div>
    </>
  );
};

export default Dashboard;
