/**
 * In-process metrics collector for the orchestration layer.
 *
 * Tracks counters, histograms (latency), and gauges that can be
 * scraped by a /metrics endpoint or pushed to an external backend.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetricPoint {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

export interface HistogramSummary {
  count: number;
  sum: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

export class MetricsCollector {
  private readonly counters: Map<string, number> = new Map();
  private readonly histograms: Map<string, number[]> = new Map();
  private readonly gauges: Map<string, number> = new Map();

  // -----------------------------------------------------------------------
  // Counters
  // -----------------------------------------------------------------------

  /** Increment a counter by the given amount (default 1). */
  increment(name: string, amount = 1, labels?: Record<string, string>): void {
    const key = this.key(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + amount);
  }

  /** Read current counter value. */
  getCounter(name: string, labels?: Record<string, string>): number {
    return this.counters.get(this.key(name, labels)) ?? 0;
  }

  // -----------------------------------------------------------------------
  // Histograms (latency, token counts, etc.)
  // -----------------------------------------------------------------------

  /** Record a value in a histogram. */
  observe(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.key(name, labels);
    const values = this.histograms.get(key) ?? [];
    values.push(value);
    this.histograms.set(key, values);
  }

  /** Get a statistical summary for a histogram. */
  getHistogram(name: string, labels?: Record<string, string>): HistogramSummary | null {
    const values = this.histograms.get(this.key(name, labels));
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      sum,
      min: sorted[0]!,
      max: sorted[count - 1]!,
      p50: sorted[Math.floor(count * 0.5)]!,
      p95: sorted[Math.floor(count * 0.95)]!,
      p99: sorted[Math.floor(count * 0.99)]!,
    };
  }

  // -----------------------------------------------------------------------
  // Gauges
  // -----------------------------------------------------------------------

  /** Set a gauge to an absolute value. */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.gauges.set(this.key(name, labels), value);
  }

  /** Read current gauge value. */
  getGauge(name: string, labels?: Record<string, string>): number {
    return this.gauges.get(this.key(name, labels)) ?? 0;
  }

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------

  /** Export all metrics as a flat array for JSON serialisation. */
  export(): MetricPoint[] {
    const now = new Date().toISOString();
    const points: MetricPoint[] = [];

    for (const [key, value] of this.counters) {
      const { name, labels } = this.parseKey(key);
      points.push({ name: `counter.${name}`, value, labels, timestamp: now });
    }

    for (const [key] of this.histograms) {
      const { name, labels } = this.parseKey(key);
      const summary = this.getHistogram(name, labels);
      if (summary) {
        points.push({ name: `histogram.${name}.count`, value: summary.count, labels, timestamp: now });
        points.push({ name: `histogram.${name}.p50`, value: summary.p50, labels, timestamp: now });
        points.push({ name: `histogram.${name}.p95`, value: summary.p95, labels, timestamp: now });
        points.push({ name: `histogram.${name}.p99`, value: summary.p99, labels, timestamp: now });
      }
    }

    for (const [key, value] of this.gauges) {
      const { name, labels } = this.parseKey(key);
      points.push({ name: `gauge.${name}`, value, labels, timestamp: now });
    }

    return points;
  }

  /** Reset all metrics (useful for testing or periodic export-and-reset). */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private key(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) return name;
    const sorted = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${sorted}}`;
  }

  private parseKey(key: string): { name: string; labels: Record<string, string> } {
    const braceIdx = key.indexOf('{');
    if (braceIdx === -1) return { name: key, labels: {} };

    const name = key.slice(0, braceIdx);
    const labelStr = key.slice(braceIdx + 1, -1);
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(',')) {
      const [k, v] = pair.split('=');
      if (k && v) labels[k] = v;
    }
    return { name, labels };
  }
}

/** Singleton metrics instance for the orchestration layer. */
export const orchestrationMetrics = new MetricsCollector();
