/**
 * Tests for observability layer — Logger and MetricsCollector.
 */

import { Logger, createLogger } from "../observability/logger";
import {
  MetricsCollector,
  orchestrationMetrics,
} from "../observability/metrics";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

describe("Logger", () => {
  let writeSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Intercept console.log (non-production path) and stdout/stderr
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    writeSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a logger with createLogger factory", () => {
    const logger = createLogger("test.module");
    expect(logger).toBeInstanceOf(Logger);
  });

  it("logs an info message in development mode (non-production)", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const logger = new Logger("test-module", "info");
    logger.info("hello world");
    expect(consoleSpy).toHaveBeenCalled();
    process.env.NODE_ENV = prevEnv;
  });

  it("logs a JSON line to stdout in production mode for info", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const logger = new Logger("test-module", "info");
    logger.info("production log");
    expect(writeSpy).toHaveBeenCalled();
    const written = writeSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("production log");
    expect(parsed.module).toBe("test-module");
    process.env.NODE_ENV = prevEnv;
  });

  it("logs error messages to stderr in production mode", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const stderrSpy = jest
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const logger = new Logger("test-module", "debug");
    logger.error("something broke");
    expect(stderrSpy).toHaveBeenCalled();
    process.env.NODE_ENV = prevEnv;
  });

  it("respects minimum log level filtering", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const logger = new Logger("test-module", "warn");
    logger.debug("debug should be suppressed");
    logger.info("info should be suppressed");
    expect(consoleSpy).not.toHaveBeenCalled();
    process.env.NODE_ENV = prevEnv;
  });

  it("logs at or above the minimum level", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const logger = new Logger("test-module", "warn");
    logger.warn("this should appear");
    expect(consoleSpy).toHaveBeenCalled();
    process.env.NODE_ENV = prevEnv;
  });

  it("withRequestId creates a child logger that includes requestId", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const logger = new Logger("test-module", "debug");
    const child = logger.withRequestId("req-42");
    child.info("with request id");
    expect(writeSpy).toHaveBeenCalled();
    const written = writeSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed.requestId).toBe("req-42");
    process.env.NODE_ENV = prevEnv;
  });

  it("parent logger does not have requestId after withRequestId", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const logger = new Logger("test-module", "debug");
    logger.withRequestId("req-99"); // side-effect-free on parent
    logger.info("parent log");
    const written = writeSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed.requestId).toBeUndefined();
    process.env.NODE_ENV = prevEnv;
  });

  it("includes structured context fields in log output", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const logger = new Logger("ctx-test", "debug");
    logger.debug("ctx log", { agentId: "agent-1", latencyMs: 150 });
    const written = writeSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed.context?.agentId).toBe("agent-1");
    expect(parsed.context?.latencyMs).toBe(150);
    process.env.NODE_ENV = prevEnv;
  });

  it("does not include context key when context is empty", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const logger = new Logger("ctx-test", "debug");
    logger.debug("no context");
    const written = writeSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed.context).toBeUndefined();
    process.env.NODE_ENV = prevEnv;
  });
});

// ---------------------------------------------------------------------------
// MetricsCollector
// ---------------------------------------------------------------------------

describe("MetricsCollector", () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
  });

  // --- Counters ---

  describe("counters", () => {
    it("starts at 0 for an unseen counter name", () => {
      expect(metrics.getCounter("new.counter")).toBe(0);
    });

    it("increments by 1 by default", () => {
      metrics.increment("req.total");
      metrics.increment("req.total");
      expect(metrics.getCounter("req.total")).toBe(2);
    });

    it("increments by a custom amount", () => {
      metrics.increment("tokens", 150);
      metrics.increment("tokens", 50);
      expect(metrics.getCounter("tokens")).toBe(200);
    });

    it("supports label-scoped counters", () => {
      metrics.increment("req.total", 1, { provider: "anthropic" });
      metrics.increment("req.total", 1, { provider: "google" });
      expect(metrics.getCounter("req.total", { provider: "anthropic" })).toBe(
        1,
      );
      expect(metrics.getCounter("req.total", { provider: "google" })).toBe(1);
      expect(metrics.getCounter("req.total")).toBe(0); // unlabeled is separate
    });
  });

  // --- Histograms ---

  describe("histograms", () => {
    it("returns null for an unknown histogram", () => {
      expect(metrics.getHistogram("latency")).toBeNull();
    });

    it("calculates correct count and sum", () => {
      metrics.observe("latency", 100);
      metrics.observe("latency", 200);
      metrics.observe("latency", 300);
      const h = metrics.getHistogram("latency")!;
      expect(h.count).toBe(3);
      expect(h.sum).toBe(600);
      expect(h.min).toBe(100);
      expect(h.max).toBe(300);
    });

    it("calculates p50 correctly for odd-count data", () => {
      [10, 20, 30, 40, 50].forEach((v) => metrics.observe("lat", v));
      const h = metrics.getHistogram("lat")!;
      // sorted: [10, 20, 30, 40, 50] → index floor(5*0.5)=2 → 30
      expect(h.p50).toBe(30);
    });

    it("supports labelled histograms", () => {
      metrics.observe("latency", 100, { agent: "supervisor" });
      metrics.observe("latency", 200, { agent: "supervisor" });
      const h = metrics.getHistogram("latency", { agent: "supervisor" })!;
      expect(h.count).toBe(2);
      expect(metrics.getHistogram("latency")).toBeNull(); // unlabeled still null
    });

    it("single-observation histogram has equal min/max/p50/p95/p99", () => {
      metrics.observe("single", 42);
      const h = metrics.getHistogram("single")!;
      expect(h.min).toBe(42);
      expect(h.max).toBe(42);
      expect(h.p50).toBe(42);
      expect(h.p95).toBe(42);
      expect(h.p99).toBe(42);
    });
  });

  // --- Gauges ---

  describe("gauges", () => {
    it("returns 0 for an unknown gauge", () => {
      expect(metrics.getGauge("budget.remaining")).toBe(0);
    });

    it("sets and overwrites gauge value", () => {
      metrics.setGauge("budget.remaining", 8.5);
      metrics.setGauge("budget.remaining", 7.2);
      expect(metrics.getGauge("budget.remaining")).toBe(7.2);
    });

    it("supports labelled gauges", () => {
      metrics.setGauge("connections", 5, { pool: "primary" });
      metrics.setGauge("connections", 2, { pool: "replica" });
      expect(metrics.getGauge("connections", { pool: "primary" })).toBe(5);
      expect(metrics.getGauge("connections", { pool: "replica" })).toBe(2);
    });
  });

  // --- Export ---

  describe("export", () => {
    it("returns an empty array when no metrics recorded", () => {
      expect(metrics.export()).toEqual([]);
    });

    it("includes counter points with 'counter.' prefix", () => {
      metrics.increment("req.success", 3);
      const points = metrics.export();
      const counterPoint = points.find((p) => p.name === "counter.req.success");
      expect(counterPoint).toBeDefined();
      expect(counterPoint!.value).toBe(3);
    });

    it("includes histogram count and percentile points", () => {
      metrics.observe("latency.ms", 50);
      metrics.observe("latency.ms", 150);
      const points = metrics.export();
      const names = points.map((p) => p.name);
      expect(names).toContain("histogram.latency.ms.count");
      expect(names).toContain("histogram.latency.ms.p50");
      expect(names).toContain("histogram.latency.ms.p95");
      expect(names).toContain("histogram.latency.ms.p99");
    });

    it("includes gauge points with 'gauge.' prefix", () => {
      metrics.setGauge("budget.usd", 9.99);
      const points = metrics.export();
      const gaugePoint = points.find((p) => p.name === "gauge.budget.usd");
      expect(gaugePoint).toBeDefined();
      expect(gaugePoint!.value).toBe(9.99);
    });

    it("each exported point has a timestamp string", () => {
      metrics.increment("x");
      const points = metrics.export();
      expect(points[0]!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("labelled metrics carry their labels in the export", () => {
      metrics.increment("req.total", 1, { provider: "anthropic" });
      const points = metrics.export();
      const point = points.find((p) => p.labels?.provider === "anthropic");
      expect(point).toBeDefined();
    });
  });

  // --- Reset ---

  describe("reset", () => {
    it("clears all counters, histograms, and gauges", () => {
      metrics.increment("x");
      metrics.observe("y", 1);
      metrics.setGauge("z", 5);
      metrics.reset();
      expect(metrics.export()).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Singleton orchestrationMetrics
// ---------------------------------------------------------------------------

describe("orchestrationMetrics singleton", () => {
  afterEach(() => {
    orchestrationMetrics.reset();
  });

  it("is a MetricsCollector instance", () => {
    expect(orchestrationMetrics).toBeInstanceOf(MetricsCollector);
  });

  it("can record and retrieve counter values", () => {
    orchestrationMetrics.increment("test.counter", 7);
    expect(orchestrationMetrics.getCounter("test.counter")).toBe(7);
  });
});
