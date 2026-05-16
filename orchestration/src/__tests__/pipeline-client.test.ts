/**
 * Tests for PipelineClient — the HTTP bridge to the Python pipeline API.
 * `fetch` is mocked; no real network traffic.
 */

import { PipelineClient } from "../bridge/pipeline-client";

interface FakeResponseInit {
  ok?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}

function fakeResponse(init: FakeResponseInit = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? status < 400,
    status,
    json: async () => init.json ?? {},
    text: async () => init.text ?? "",
  } as unknown as Response;
}

const originalFetch = global.fetch;
let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  delete process.env.PIPELINE_API_URL;
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("PipelineClient — configuration", () => {
  it("defaults to the local pipeline API on port 8000", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse({ json: { status: "healthy" } }),
    );
    const client = new PipelineClient();
    await client.health();
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/health");
  });

  it("strips a trailing slash from the configured base URL", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ json: {} }));
    const client = new PipelineClient({ baseUrl: "http://api.internal:9000/" });
    await client.health();
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.internal:9000/health");
  });

  it("honors the PIPELINE_API_URL environment variable", async () => {
    process.env.PIPELINE_API_URL = "http://env-host:7000";
    fetchMock.mockResolvedValueOnce(fakeResponse({ json: {} }));
    const client = new PipelineClient();
    await client.health();
    expect(fetchMock.mock.calls[0][0]).toBe("http://env-host:7000/health");
  });
});

describe("PipelineClient — request methods", () => {
  it("processArticle POSTs to /process and returns the parsed body", async () => {
    const result = { article_id: "a1", status: "completed", duration_ms: 12 };
    fetchMock.mockResolvedValueOnce(fakeResponse({ json: result }));

    const client = new PipelineClient({ baseUrl: "http://x" });
    const out = await client.processArticle({
      article: { article_id: "a1", content: "body" },
    });

    expect(out).toEqual(result);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("http://x/process");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({
      article: { article_id: "a1", content: "body" },
    });
  });

  it("analyzeContent POSTs to /analyze", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse({ json: { status: "ok", analysis_type: "full" } }),
    );
    const client = new PipelineClient({ baseUrl: "http://x" });
    await client.analyzeContent({ content: "text" });
    expect(fetchMock.mock.calls[0][0]).toBe("http://x/analyze");
  });

  it("processBatch POSTs to /batch", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse({
        json: {
          total: 0,
          succeeded: 0,
          failed: 0,
          duration_ms: 0,
          results: [],
        },
      }),
    );
    const client = new PipelineClient({ baseUrl: "http://x" });
    await client.processBatch({ articles: [] });
    expect(fetchMock.mock.calls[0][0]).toBe("http://x/batch");
  });

  it("health GETs /health", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse({ json: { status: "healthy" } }),
    );
    const client = new PipelineClient({ baseUrl: "http://x" });
    await client.health();
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });
});

describe("PipelineClient — error handling", () => {
  it("throws on a non-retryable 4xx response", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse({ status: 400, text: "bad request" }),
    );
    const client = new PipelineClient({ baseUrl: "http://x", retries: 2 });
    await expect(client.health()).rejects.toThrow(/returned 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on a 503 and succeeds on the next attempt", async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ status: 503, text: "unavailable" }))
      .mockResolvedValueOnce(fakeResponse({ json: { status: "healthy" } }));
    const client = new PipelineClient({ baseUrl: "http://x", retries: 1 });
    const out = await client.health();
    expect(out).toEqual({ status: "healthy" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after exhausting retries on persistent 503", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ status: 503, text: "down" }));
    const client = new PipelineClient({ baseUrl: "http://x", retries: 1 });
    await expect(client.health()).rejects.toThrow(/returned 503/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on a network error then succeeds", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(fakeResponse({ json: { status: "healthy" } }));
    const client = new PipelineClient({ baseUrl: "http://x", retries: 1 });
    const out = await client.health();
    expect(out).toEqual({ status: "healthy" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces a timeout as a descriptive error", async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException("The operation was aborted", "AbortError"),
    );
    const client = new PipelineClient({ baseUrl: "http://x", retries: 0 });
    await expect(client.health()).rejects.toThrow(/timed out/);
  });
});

describe("PipelineClient.isAvailable", () => {
  it("is true when the pipeline reports ready", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse({
        json: { status: "healthy", pipeline_ready: true, version: "1" },
      }),
    );
    const client = new PipelineClient({ baseUrl: "http://x" });
    expect(await client.isAvailable()).toBe(true);
  });

  it("is false when the pipeline is not ready", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse({
        json: { status: "degraded", pipeline_ready: false, version: "1" },
      }),
    );
    const client = new PipelineClient({ baseUrl: "http://x" });
    expect(await client.isAvailable()).toBe(false);
  });

  it("is false when the health call fails entirely", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ status: 500, text: "boom" }));
    const client = new PipelineClient({ baseUrl: "http://x", retries: 0 });
    expect(await client.isAvailable()).toBe(false);
  });
});
