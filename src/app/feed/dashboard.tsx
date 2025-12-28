"use client";

import DailyActivityChart, {
  NumberOfArticlesReadLast7DaysChartData,
} from "@/app/feed/daily-activity-chart";
import DailyNewArticlesChart, {
  NumberOfArticlesLast7DaysChartData,
} from "@/app/feed/daily-new-articles-chart";
import TokenUsageChart from "@/app/feed/token-usage-chart";
import UnreadArticlesPieChart, {
  UnreadArticlesChartData,
} from "@/app/feed/unread-articles-pie-chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getTokenUsageHistory,
  getUnreadArticlesPerFeed,
  getWeeklyArticleCountPerFeed,
  getWeeklyArticlesRead,
} from "@/lib/repository/statsRepository";
import { useEffect, useState } from "react";
import { TokenUsage } from "../../../prisma/generated/prisma/client";

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

  const [unreadArticlesChartData, setUnreadArticlesChartData] =
    useState<UnreadArticlesChartData[]>();
  const [tokenUsageChartData, setTokenUsageChartData] =
    useState<TokenUsage[]>();
  const [numberOfNewArticlesChartData, setNumberOfNewArticlesChartData] =
    useState<NumberOfArticlesLast7DaysChartData[]>();
  const [weeklyArticlesReadChartData, setWeeklyArticlesReadChartData] =
    useState<NumberOfArticlesReadLast7DaysChartData[]>();

  useEffect(() => {
    const dateRange = getDateRangeFromPreset(selectedRange);

    getUnreadArticlesPerFeed().then((data) => setUnreadArticlesChartData(data));

    getTokenUsageHistory(dateRange.from, dateRange.to).then((data) =>
      setTokenUsageChartData(data),
    );

    getWeeklyArticleCountPerFeed(dateRange.from, dateRange.to).then((data) =>
      setNumberOfNewArticlesChartData(data),
    );

    getWeeklyArticlesRead(dateRange.from, dateRange.to).then((data) =>
      setWeeklyArticlesReadChartData(data),
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

      <div className="mx-auto hidden w-full max-w-7xl grid-cols-1 gap-4 md:visible md:grid md:grid-cols-2 lg:grid-cols-4">
        <UnreadArticlesPieChart chartData={unreadArticlesChartData} />
        <TokenUsageChart chartData={tokenUsageChartData} />
        <DailyNewArticlesChart chartData={numberOfNewArticlesChartData} />
        <DailyActivityChart
          chartData={weeklyArticlesReadChartData}
        ></DailyActivityChart>
      </div>
    </>
  );
};

export default Dashboard;
