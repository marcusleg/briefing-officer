"use server";

import { getMetricsText } from "@/lib/metrics";
import { formatGaugeMetrics } from "@/lib/metricsFormatter";
import { collectGaugeMetrics } from "@/lib/metricsRepository";

const contentType = "text/plain; version=0.0.4; charset=utf-8";

export const GET = async (request: Request) => {
  const token = process.env.METRICS_TOKEN;

  if (!token) {
    return new Response("Not Found", { status: 404 });
  }

  if (request.headers.get("authorization") !== `Bearer ${token}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const [gaugeMetrics, runtimeMetrics] = await Promise.all([
      collectGaugeMetrics(),
      getMetricsText(),
    ]);

    return new Response(
      `${formatGaugeMetrics(gaugeMetrics)}\n${runtimeMetrics}`,
      {
        status: 200,
        headers: {
          "content-type": contentType,
        },
      },
    );
  } catch {
    return new Response("Service Unavailable", { status: 503 });
  }
};
