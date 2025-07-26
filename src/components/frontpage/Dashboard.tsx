import NumberOfArticlesReadLast7DaysChart from "@/components/frontpage/NumberOfArticlesReadLast7DaysChart";
import UnreadArticlesChart from "@/components/frontpage/UnreadArticlesChart";
import {
  getTokenUsageHistory,
  getUnreadArticlesPerFeed,
  getWeeklyArticleCountPerFeed,
  getWeeklyArticlesRead,
} from "@/lib/repository/statsRepository";
import NumberOfNewArticlesLast7DaysChart from "./NumberOfNewArticlesLast7DaysChart";
import TokenUsageChart from "./TokenUsageChart";

const Dashboard = async () => {
  const unreadArticlesChartData = await getUnreadArticlesPerFeed();
  const numberOfNewArticlesLast7DaysChartData =
    await getWeeklyArticleCountPerFeed();
  const numberOfArticlesReadLast7DaysChartData = await getWeeklyArticlesRead();
  const tokenUsageChartData = await getTokenUsageHistory();

  return (
    <div className="hidden grid-cols-4 gap-4 lg:visible lg:grid">
      <UnreadArticlesChart chartData={unreadArticlesChartData} />
      <TokenUsageChart tokenUsage={tokenUsageChartData} />
      <NumberOfNewArticlesLast7DaysChart
        chartData={numberOfNewArticlesLast7DaysChartData}
      />
      <NumberOfArticlesReadLast7DaysChart
        chartData={numberOfArticlesReadLast7DaysChartData}
      ></NumberOfArticlesReadLast7DaysChart>
    </div>
  );
};

export default Dashboard;
