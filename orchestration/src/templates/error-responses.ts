/**
 * Standardised error response templates for the orchestration layer.
 *
 * Ensures consistent, user-friendly error messages across all failure modes.
 */

import { AgentErrorType } from "../agents/types";

export interface ErrorResponse {
  /** Machine-readable error code. */
  code: string;
  /** User-facing message. */
  message: string;
  /** HTTP status code suggestion. */
  httpStatus: number;
  /** Whether the client should retry. */
  retryable: boolean;
  /** Suggested retry delay in seconds (if retryable). */
  retryAfterSeconds?: number;
}

const ERROR_TEMPLATES: Record<string, ErrorResponse> = {
  [AgentErrorType.rate_limited]: {
    code: "RATE_LIMITED",
    message:
      "The service is experiencing high demand. Please try again shortly.",
    httpStatus: 429,
    retryable: true,
    retryAfterSeconds: 30,
  },
  [AgentErrorType.budget_exceeded]: {
    code: "BUDGET_EXCEEDED",
    message:
      "The daily usage budget has been reached. Please try again tomorrow.",
    httpStatus: 429,
    retryable: false,
  },
  [AgentErrorType.provider_unavailable]: {
    code: "SERVICE_UNAVAILABLE",
    message:
      "The AI service is temporarily unavailable. Please try again in a few minutes.",
    httpStatus: 503,
    retryable: true,
    retryAfterSeconds: 60,
  },
  [AgentErrorType.timeout]: {
    code: "REQUEST_TIMEOUT",
    message:
      "The request took too long to process. Please try a shorter query.",
    httpStatus: 504,
    retryable: true,
    retryAfterSeconds: 5,
  },
  [AgentErrorType.context_overflow]: {
    code: "CONTEXT_TOO_LARGE",
    message:
      "The conversation is too long. Please start a new session or ask a shorter question.",
    httpStatus: 413,
    retryable: false,
  },
  [AgentErrorType.content_filtered]: {
    code: "CONTENT_FILTERED",
    message: "The request was filtered by content safety policies.",
    httpStatus: 400,
    retryable: false,
  },
  [AgentErrorType.authentication]: {
    code: "AUTH_ERROR",
    message:
      "Authentication with the AI provider failed. Please contact support.",
    httpStatus: 500,
    retryable: false,
  },
  unknown: {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred. Please try again.",
    httpStatus: 500,
    retryable: true,
    retryAfterSeconds: 10,
  },
};

/**
 * Get a standardised error response for a given error type.
 * Falls back to a generic internal error for unknown types.
 */
export function getErrorResponse(errorType: string): ErrorResponse {
  return ERROR_TEMPLATES[errorType] ?? ERROR_TEMPLATES["unknown"]!;
}

/**
 * Format an error for JSON API responses, including optional request ID.
 */
export function formatApiError(
  errorType: string,
  requestId?: string,
): { error: ErrorResponse & { requestId?: string } } {
  const response = getErrorResponse(errorType);
  return {
    error: {
      ...response,
      ...(requestId ? { requestId } : {}),
    },
  };
}
