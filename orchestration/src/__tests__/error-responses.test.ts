/**
 * Tests for error-response templates.
 */

import {
  getErrorResponse,
  formatApiError,
  type ErrorResponse,
} from "../templates/error-responses";
import { AgentErrorType } from "../agents/types";

// ---------------------------------------------------------------------------
// getErrorResponse
// ---------------------------------------------------------------------------

describe("getErrorResponse", () => {
  it("returns RATE_LIMITED template for rate_limited error type", () => {
    const resp = getErrorResponse(AgentErrorType.rate_limited);
    expect(resp.code).toBe("RATE_LIMITED");
    expect(resp.httpStatus).toBe(429);
    expect(resp.retryable).toBe(true);
    expect(resp.retryAfterSeconds).toBeDefined();
  });

  it("returns BUDGET_EXCEEDED template for budget_exceeded error type", () => {
    const resp = getErrorResponse(AgentErrorType.budget_exceeded);
    expect(resp.code).toBe("BUDGET_EXCEEDED");
    expect(resp.httpStatus).toBe(429);
    expect(resp.retryable).toBe(false);
    expect(resp.retryAfterSeconds).toBeUndefined();
  });

  it("returns SERVICE_UNAVAILABLE template for provider_unavailable", () => {
    const resp = getErrorResponse(AgentErrorType.provider_unavailable);
    expect(resp.code).toBe("SERVICE_UNAVAILABLE");
    expect(resp.httpStatus).toBe(503);
    expect(resp.retryable).toBe(true);
  });

  it("returns REQUEST_TIMEOUT template for timeout", () => {
    const resp = getErrorResponse(AgentErrorType.timeout);
    expect(resp.code).toBe("REQUEST_TIMEOUT");
    expect(resp.httpStatus).toBe(504);
    expect(resp.retryable).toBe(true);
  });

  it("returns CONTEXT_TOO_LARGE template for context_overflow", () => {
    const resp = getErrorResponse(AgentErrorType.context_overflow);
    expect(resp.code).toBe("CONTEXT_TOO_LARGE");
    expect(resp.httpStatus).toBe(413);
    expect(resp.retryable).toBe(false);
  });

  it("returns CONTENT_FILTERED template for content_filtered", () => {
    const resp = getErrorResponse(AgentErrorType.content_filtered);
    expect(resp.code).toBe("CONTENT_FILTERED");
    expect(resp.httpStatus).toBe(400);
  });

  it("returns AUTH_ERROR template for authentication error type", () => {
    const resp = getErrorResponse(AgentErrorType.authentication);
    expect(resp.code).toBe("AUTH_ERROR");
    expect(resp.httpStatus).toBe(500);
    expect(resp.retryable).toBe(false);
  });

  it("returns INTERNAL_ERROR template for unknown error types", () => {
    const resp = getErrorResponse("some_unknown_error_type_xyz");
    expect(resp.code).toBe("INTERNAL_ERROR");
    expect(resp.httpStatus).toBe(500);
    expect(resp.retryable).toBe(true);
  });

  it("returns INTERNAL_ERROR for the 'unknown' AgentErrorType", () => {
    const resp = getErrorResponse(AgentErrorType.unknown);
    expect(resp.code).toBe("INTERNAL_ERROR");
  });

  it("returns a structurally valid ErrorResponse for every AgentErrorType", () => {
    const types = Object.values(AgentErrorType);
    for (const type of types) {
      const resp = getErrorResponse(type);
      expect(typeof resp.code).toBe("string");
      expect(typeof resp.message).toBe("string");
      expect(typeof resp.httpStatus).toBe("number");
      expect(typeof resp.retryable).toBe("boolean");
    }
  });

  it("rate_limited has a retryAfterSeconds value", () => {
    const resp = getErrorResponse(AgentErrorType.rate_limited);
    expect(resp.retryAfterSeconds).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// formatApiError
// ---------------------------------------------------------------------------

describe("formatApiError", () => {
  it("returns wrapped error under an 'error' key", () => {
    const result = formatApiError(AgentErrorType.timeout);
    expect(result).toHaveProperty("error");
    expect(result.error.code).toBe("REQUEST_TIMEOUT");
  });

  it("includes requestId when provided", () => {
    const result = formatApiError(AgentErrorType.rate_limited, "req-abc-123");
    expect(result.error.requestId).toBe("req-abc-123");
  });

  it("does not include requestId when not provided", () => {
    const result = formatApiError(AgentErrorType.timeout);
    expect(result.error).not.toHaveProperty("requestId");
  });

  it("falls back to INTERNAL_ERROR for unrecognised type", () => {
    const result = formatApiError("i_do_not_exist");
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("preserves all template fields in the wrapped response", () => {
    const base = getErrorResponse(AgentErrorType.provider_unavailable);
    const result = formatApiError(AgentErrorType.provider_unavailable, "r1");
    const { requestId: _rid, ...rest } = result.error;
    expect(rest).toMatchObject<ErrorResponse>(base);
  });
});
