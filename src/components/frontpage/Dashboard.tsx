"use client";

import ArticlesReadPerDayChart, {
  NumberOfArticlesReadLast7DaysChartData,
} from "@/components/frontpage/ArticlesReadPerDayChart";
import NewArticlesPerDayChart, {
  NumberOfArticlesLast7DaysChartData,
} from "@/components/frontpage/NewArticlesPerDayChart";
import TokenUsagePerDayChart from "@/components/frontpage/TokenUsagePerDayChart";
import UnreadArticlesPieChart, {
  UnreadArticlesChartData,
} from "@/components/frontpage/UnreadArticlesPieChart";
import { DateRangePicker } from "@/components/layout/DateRangePicker";
import {
  getTokenUsageHistory,
  getUnreadArticlesPerFeed,
  getWeeklyArticleCountPerFeed,
  getWeeklyArticlesRead,
} from "@/lib/repository/statsRepository";
import { TokenUsage } from "@prisma/client";
import { useEffect, useState } from "react";

const Dashboard = () => {
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

    getTokenUsageHistory().then((data) => setTokenUsageChartData(data));

    getWeeklyArticleCountPerFeed().then((data) =>
      setNumberOfNewArticlesChartData(data),
    );

    getWeeklyArticlesRead().then((data) =>
      setWeeklyArticlesReadChartData(data),
    );
  });

  return (
    <>
      <DateRangePicker />
      <div className="hidden grid-cols-4 gap-4 lg:visible lg:grid">
        <UnreadArticlesPieChart chartData={unreadArticlesChartData} />
        <TokenUsagePerDayChart tokenUsage={tokenUsageChartData} />
        <NewArticlesPerDayChart chartData={numberOfNewArticlesChartData} />
        <ArticlesReadPerDayChart
          chartData={weeklyArticlesReadChartData}
        ></ArticlesReadPerDayChart>
      </div>
    </>
  );
};

export default Dashboard;
