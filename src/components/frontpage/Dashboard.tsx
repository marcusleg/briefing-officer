"use client";

import NumberOfArticlesReadLast7DaysChart, {
  NumberOfArticlesReadLast7DaysChartData,
} from "@/components/frontpage/NumberOfArticlesReadLast7DaysChart";
import NumberOfNewArticlesLast7DaysChart, {
  NumberOfArticlesLast7DaysChartData,
} from "@/components/frontpage/NumberOfNewArticlesLast7DaysChart";
import TokenUsageChart from "@/components/frontpage/TokenUsageChart";
import UnreadArticlesChart, {
  UnreadArticlesChartData,
} from "@/components/frontpage/UnreadArticlesChart";
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
        <UnreadArticlesChart chartData={unreadArticlesChartData} />
        <TokenUsageChart tokenUsage={tokenUsageChartData} />
        <NumberOfNewArticlesLast7DaysChart
          chartData={numberOfNewArticlesChartData}
        />
        <NumberOfArticlesReadLast7DaysChart
          chartData={weeklyArticlesReadChartData}
        ></NumberOfArticlesReadLast7DaysChart>
      </div>
    </>
  );
};

export default Dashboard;
