"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UnreadArticlesInTotalChartProps {
  unreadArticles: number;
}

const UnreadArticlesInTotalChart = ({
  unreadArticles,
}: UnreadArticlesInTotalChartProps) => (
  <Card>
    <CardHeader>
      <CardTitle>Unread articles</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-center text-5xl">{unreadArticles}</div>
    </CardContent>
  </Card>
);

export default UnreadArticlesInTotalChart;
