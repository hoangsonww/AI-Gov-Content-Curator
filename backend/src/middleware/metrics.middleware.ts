import { Request, Response, NextFunction } from "express";
import client from "prom-client";

// Collect default Node.js metrics (heap, GC, event loop lag, etc.)
client.collectDefaultMetrics({ prefix: "synthoraai_" });

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"] as const,
});

export const httpRequestDurationMs = new client.Histogram({
  name: "http_request_duration_milliseconds",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [50, 100, 200, 300, 500, 1000, 2000, 5000, 10000],
});

// Business-level counters pushed by the crawler/newsletter jobs.
// Initialised here so Prometheus always sees the series (avoids missing-metric gaps).
export const crawlRunsTotal = new client.Counter({
  name: "crawl_runs_total",
  help: "Total crawler job executions",
  labelNames: ["status"] as const,
});

export const newsletterSendsTotal = new client.Counter({
  name: "newsletter_sends_total",
  help: "Total newsletter send attempts",
  labelNames: ["status"] as const,
});

export const crawlLastSuccessTimestamp = new client.Gauge({
  name: "crawl_last_success_timestamp_seconds",
  help: "Unix timestamp of the last successful crawl run",
});

export const { register } = client;

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const end = httpRequestDurationMs.startTimer();

  res.on("finish", () => {
    const route = (req.route?.path as string | undefined) ?? req.path;
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    end(labels);
  });

  next();
}
