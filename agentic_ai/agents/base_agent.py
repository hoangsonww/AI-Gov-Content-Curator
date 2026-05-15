"""
Base Agent class for all specialized agents in the pipeline.

Production hardening:
- Provider key sourced from `Settings.get_provider_key()` (SecretStr-aware).
- Each agent's `process` is wrapped with retry + circuit breaker + timeout
  via `mcp_server.resilience.guarded_call`.
- Every invocation emits an OpenTelemetry span with provider/model/agent
  attributes and Prometheus metrics for duration + outcome.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Any, Optional

import structlog
from langchain_anthropic import ChatAnthropic
from langchain_cohere import ChatCohere
from langchain_core.language_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from ..config.settings import settings
from mcp_server.errors import (
    ConfigurationError,
    PermanentUpstreamError,
    TimeoutError_,
    TransientUpstreamError,
)
from mcp_server.observability import metrics, record_llm_call, traced_async_span
from mcp_server.resilience import guarded_call

logger = structlog.get_logger("agents.base")


_TRANSIENT_KEYWORDS = (
    "timeout",
    "timed out",
    "temporarily",
    "rate limit",
    "overloaded",
    "503",
    "502",
    "504",
    "429",
    "deadline",
    "connection reset",
)


def _classify_provider_error(exc: BaseException) -> BaseException:
    """Map raw provider exceptions to typed errors.

    LangChain wraps provider errors inconsistently; pattern-match the
    message string to decide retryability. Anything that doesn't smell
    transient is treated as permanent so the retry policy doesn't burn
    attempts on a malformed prompt.
    """
    if isinstance(exc, (TransientUpstreamError, PermanentUpstreamError, TimeoutError_)):
        return exc
    msg = str(exc).lower()
    if any(k in msg for k in _TRANSIENT_KEYWORDS):
        return TransientUpstreamError(str(exc) or exc.__class__.__name__)
    return PermanentUpstreamError(str(exc) or exc.__class__.__name__)


class BaseAgent(ABC):
    """Abstract base class for all agents."""

    def __init__(self, name: str, llm: Optional[BaseChatModel] = None):
        self.name = name
        self.llm = llm or self._get_default_llm()
        self._logger = logger.bind(agent=name)
        self._logger.info("agent.initialized")

    # ── LLM construction ────────────────────────────────────────────────

    def _get_default_llm(self) -> BaseChatModel:
        provider = settings.default_llm_provider
        key = settings.get_provider_key(provider)
        if key is None:
            raise ConfigurationError(
                f"{provider.upper()}_API_KEY is required when "
                f"DEFAULT_LLM_PROVIDER={provider}"
            )

        timeout = settings.llm_request_timeout_seconds
        common: dict[str, Any] = {
            "temperature": settings.temperature,
            "max_tokens": settings.max_tokens,
        }

        if provider == "google":
            return ChatGoogleGenerativeAI(
                model=settings.default_model,
                google_api_key=key,
                timeout=timeout,
                **common,
            )
        if provider == "openai":
            return ChatOpenAI(
                model=settings.default_model,
                api_key=key,
                timeout=timeout,
                **common,
            )
        if provider == "anthropic":
            return ChatAnthropic(
                model=settings.default_model,
                anthropic_api_key=key,
                timeout=timeout,
                **common,
            )
        if provider == "cohere":
            return ChatCohere(
                model=settings.default_model,
                cohere_api_key=key,
                **common,
            )
        raise ConfigurationError(
            f"Unsupported LLM provider: {provider}. "
            "Supported providers: google, openai, anthropic, cohere"
        )

    # ── Subclass contract ───────────────────────────────────────────────

    @abstractmethod
    async def process(self, *args: Any, **kwargs: Any) -> Any:
        """Process method to be implemented by subclasses.

        Subclass `process` will be wrapped by `invoke()` which adds tracing,
        metrics, retries, and circuit breaking. Call `invoke()` from the
        pipeline, not `process()` directly.
        """
        ...

    # ── Public entry point used by the pipeline ─────────────────────────

    async def invoke(self, *args: Any, **kwargs: Any) -> Any:
        """Run the agent with full resilience + observability.

        Wraps `process()` with:
          - OTel span (agent name, provider, model)
          - Prometheus duration + outcome metrics
          - Retry on transient upstream errors
          - Circuit breaker per-provider
          - Per-call timeout (`agent_timeout`)
        """
        provider = settings.default_llm_provider
        breaker_name = f"agent:{self.name}:{provider}"

        @guarded_call(
            name=breaker_name,
            timeout_s=float(settings.agent_timeout),
            max_attempts=settings.llm_max_attempts,
            breaker_fail_max=settings.llm_circuit_fail_max,
            breaker_reset_timeout_s=settings.llm_circuit_reset_seconds,
        )
        async def _run() -> Any:
            import asyncio
            import inspect

            start = time.monotonic()
            async with traced_async_span(
                f"agent.{self.name}",
                **{
                    "agent.name": self.name,
                    "llm.provider": provider,
                    "llm.model": settings.default_model,
                },
            ) as span:
                try:
                    if inspect.iscoroutinefunction(self.process):
                        result = await self.process(*args, **kwargs)
                    else:
                        # Run sync agent code on a worker thread so the event
                        # loop stays responsive for other concurrent jobs.
                        result = await asyncio.to_thread(self.process, *args, **kwargs)
                except Exception as raw:
                    err = _classify_provider_error(raw)
                    record_llm_call(
                        provider=provider,
                        model=settings.default_model,
                        status="error",
                        duration_s=time.monotonic() - start,
                    )
                    metrics().agent_invocations_total.labels(
                        agent=self.name,
                        status="error",
                    ).inc()
                    self._logger.warning(
                        "agent.process_failed",
                        error_type=type(raw).__name__,
                        classified_as=type(err).__name__,
                        message=str(raw),
                    )
                    raise err from raw

                duration = time.monotonic() - start
                metrics().agent_duration_seconds.labels(agent=self.name).observe(duration)
                metrics().agent_invocations_total.labels(
                    agent=self.name,
                    status="ok",
                ).inc()
                record_llm_call(
                    provider=provider,
                    model=settings.default_model,
                    status="ok",
                    duration_s=duration,
                )
                if span is not None:
                    try:
                        span.set_attribute("agent.duration_ms", int(duration * 1000))
                    except Exception:
                        pass
                return result

        return await _run()

    # ── Error helper for subclasses ─────────────────────────────────────

    def _handle_error(self, error: Exception, context: dict[str, Any]) -> dict[str, Any]:
        """Build a uniform error envelope. Logging is structured + redacted."""
        self._logger.error("agent.error", error=str(error), context=context)
        return {
            "error": str(error),
            "agent": self.name,
            "context": context,
        }
