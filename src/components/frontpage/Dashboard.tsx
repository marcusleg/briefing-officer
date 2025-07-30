"use client";

import DailyActivityChart, {
  NumberOfArticlesReadLast7DaysChartData,
} from "@/components/frontpage/DailyActivityChart";
import DailyNewArticlesChart, {
  NumberOfArticlesLast7DaysChartData,
} from "@/components/frontpage/DailyNewArticlesChart";
import TokenUsageChart from "@/components/frontpage/TokenUsageChart";
import UnreadArticlesPieChart, {
  UnreadArticlesChartData,
} from "@/components/frontpage/UnreadArticlesPieChart";
import {
  getTokenUsageHistory,
  getUnreadArticlesPerFeed,
  getWeeklyArticleCountPerFeed,
  getWeeklyArticlesRead,
} from "@/lib/repository/statsRepository";
import { TokenUsage } from "@prisma/client";
import { useEffect, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";

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
  const [selectedRange, setSelectedRange] = useState<DateRangePreset>(
    DateRangePreset.Last7Days,
  );
  const [from, setFrom] = useState<Date>(new Date());
  const [to, setTo] = useState<Date>(new Date());

  useEffect(() => {
    const dateRange = getDateRangeFromPreset(selectedRange);
    setFrom(dateRange.from);
    setTo(dateRange.to);
  }, [selectedRange]);

  const [unreadArticlesChartData, setUnreadArticlesChartData] =
    useState<UnreadArticlesChartData[]>();
  const [tokenUsageChartData, setTokenUsageChartData] =
    useState<TokenUsage[]>();
  const [numberOfNewArticlesChartData, setNumberOfNewArticlesChartData] =
    useState<NumberOfArticlesLast7DaysChartData[]>();
  const [weeklyArticlesReadChartData, setWeeklyArticlesReadChartData] =
    useState<NumberOfArticlesReadLast7DaysChartData[]>();

  useEffect(() => {
    getUnreadArticlesPerFeed().then((data) => setUnreadArticlesChartData(data));

    getTokenUsageHistory(from, to).then((data) => setTokenUsageChartData(data));

    getWeeklyArticleCountPerFeed(from, to).then((data) =>
      setNumberOfNewArticlesChartData(data),
    );

    getWeeklyArticlesRead(from, to).then((data) =>
      setWeeklyArticlesReadChartData(data),
    );
  }, [selectedRange, from, to]);

  return (
    <>
      <ToggleGroup
        className="invisible md:visible"
        type="single"
        value={selectedRange}
        variant="outline"
        onValueChange={(value) => setSelectedRange(value as DateRangePreset)}
      >
        {Object.values(DateRangePreset).map((range) => (
          <ToggleGroupItem key={range} value={range}>
            {range}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="invisible grid-cols-4 gap-4 md:visible md:grid md:grid-cols-2 lg:grid-cols-4">
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
