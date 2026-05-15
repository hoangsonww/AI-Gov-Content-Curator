"""
Base Agent class for all specialized agents in the pipeline.

Production hardening:
- Provider key sourced from `Settings.get_provider_key()` (SecretStr-aware).
- `_run_chain()` is the single resilience point: every LLM call made by
  a subclass goes through retry + circuit breaker + timeout + telemetry.
  Subclasses MUST call `self._run_chain(payload)` rather than
  `self.chain.invoke(payload)` directly.
- The circuit breaker is keyed per provider (`llm:<provider>`) and shared
  across agents, so an outage in one provider trips the breaker for all
  agents using it.
- `invoke()` is an async adapter that runs the (sync) agent on a worker
  thread under an OTel span; resilience already lives in `_run_chain`.
"""

from __future__ import annotations

import asyncio
import contextlib
import time
from abc import ABC, abstractmethod
from typing import Any

import structlog
from langchain_core.language_models import BaseChatModel

# Provider integration packages are imported lazily, per selected
# provider, inside `_get_default_llm`. This keeps each provider's SDK
# optional: an image that only uses Google does not need the OpenAI /
# Anthropic / Cohere packages installed, which trims the dependency
# surface (and, for cohere, the CVEs its transitive deps carry).
from mcp_server.errors import (
    ConfigurationError,
    PermanentUpstreamError,
    TimeoutError_,
    TransientUpstreamError,
)
from mcp_server.observability import metrics, record_llm_call, traced_async_span, traced_span
from mcp_server.resilience import guarded_call

from ..config.settings import settings

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
    if isinstance(exc, TransientUpstreamError | PermanentUpstreamError | TimeoutError_):
        return exc
    msg = str(exc).lower()
    if any(k in msg for k in _TRANSIENT_KEYWORDS):
        return TransientUpstreamError(str(exc) or exc.__class__.__name__)
    return PermanentUpstreamError(str(exc) or exc.__class__.__name__)


class BaseAgent(ABC):
    """Abstract base class for all agents."""

    # Each concrete agent builds its own LCEL chain (`prompt | llm |
    # parser`) in its constructor; declared here so `_run_chain` is
    # type-checkable on the base class.
    chain: Any

    def __init__(self, name: str, llm: BaseChatModel | None = None):
        self.name = name
        self.llm = llm or self._get_default_llm()
        self._logger = logger.bind(agent=name)
        self._logger.info("agent.initialized")

    # ── LLM construction ────────────────────────────────────────────────

    # Maps provider -> the env var that supplies its key.
    _PROVIDER_KEY_ENV = {
        "google": "GOOGLE_AI_API_KEY",
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "cohere": "COHERE_API_KEY",
    }

    # Maps provider -> the pip package that supplies its integration.
    # `langchain-cohere` has no langchain-1.x release, so it is not part
    # of the default install; selecting cohere raises a clear error.
    _PROVIDER_PACKAGE = {
        "google": "langchain-google-genai",
        "openai": "langchain-openai",
        "anthropic": "langchain-anthropic",
        "cohere": "langchain-cohere (no langchain-1.x release available)",
    }

    def _get_default_llm(self) -> BaseChatModel:
        provider = settings.default_llm_provider
        if provider not in self._PROVIDER_KEY_ENV:
            raise ConfigurationError(
                f"Unsupported LLM provider: {provider}. "
                "Supported providers: google, openai, anthropic, cohere"
            )

        key = settings.get_provider_key(provider)
        if key is None:
            env_var = self._PROVIDER_KEY_ENV[provider]
            raise ConfigurationError(f"{env_var} is required when DEFAULT_LLM_PROVIDER={provider}")

        timeout = settings.llm_request_timeout_seconds
        common: dict[str, Any] = {
            "temperature": settings.temperature,
            "max_tokens": settings.max_tokens,
        }

        # Import the selected provider lazily so the others' packages stay
        # optional. A missing package surfaces as a clear ConfigurationError.
        # The provider classes are all BaseChatModel subclasses; the
        # explicit annotation pins the return type (mypy treats the
        # integration packages as untyped — see pyproject mypy overrides).
        try:
            llm: BaseChatModel
            if provider == "google":
                from langchain_google_genai import ChatGoogleGenerativeAI

                llm = ChatGoogleGenerativeAI(
                    model=settings.default_model,
                    google_api_key=key,
                    timeout=timeout,
                    **common,
                )
            elif provider == "openai":
                from langchain_openai import ChatOpenAI

                llm = ChatOpenAI(
                    model=settings.default_model,
                    api_key=key,
                    timeout=timeout,
                    **common,
                )
            elif provider == "anthropic":
                from langchain_anthropic import ChatAnthropic

                llm = ChatAnthropic(
                    model=settings.default_model,
                    anthropic_api_key=key,
                    timeout=timeout,
                    **common,
                )
            else:  # provider == "cohere"
                from langchain_cohere import ChatCohere

                llm = ChatCohere(
                    model=settings.default_model,
                    cohere_api_key=key,
                    **common,
                )
            return llm
        except ImportError as exc:
            pkg = self._PROVIDER_PACKAGE[provider]
            raise ConfigurationError(
                f"DEFAULT_LLM_PROVIDER={provider} requires the '{pkg}' "
                f"package, which is not installed: {exc}"
            ) from exc

    # ── LLM call: the single resilience point ───────────────────────────

    def _run_chain(self, payload: dict[str, Any], *, op: str | None = None) -> Any:
        """Invoke `self.chain` with retry + circuit breaker + timeout.

        This is the one place an LLM call actually happens. Every agent
        method routes through here so resilience + telemetry are uniform
        and impossible to forget.

        Raises a typed `TransientUpstreamError` / `PermanentUpstreamError`
        / `TimeoutError_` / `CircuitOpenError` on failure — never a raw
        provider exception.
        """
        provider = settings.default_llm_provider
        model = settings.default_model
        op_name = op or f"agent.{self.name}.chain"
        # Shared per-provider breaker: a provider outage trips every agent.
        breaker_name = f"llm:{provider}"

        @guarded_call(
            name=breaker_name,
            timeout_s=settings.llm_request_timeout_seconds,
            max_attempts=settings.llm_max_attempts,
            breaker_fail_max=settings.llm_circuit_fail_max,
            breaker_reset_timeout_s=settings.llm_circuit_reset_seconds,
        )
        def _call() -> Any:
            start = time.monotonic()
            with traced_span(
                op_name,
                **{
                    "agent.name": self.name,
                    "llm.provider": provider,
                    "llm.model": model,
                },
            ):
                try:
                    result = self.chain.invoke(payload)
                except Exception as raw:
                    record_llm_call(
                        provider=provider,
                        model=model,
                        status="error",
                        duration_s=time.monotonic() - start,
                    )
                    err = _classify_provider_error(raw)
                    self._logger.warning(
                        "agent.llm_call_failed",
                        error_type=type(raw).__name__,
                        classified_as=type(err).__name__,
                        message=str(raw),
                    )
                    raise err from raw

                record_llm_call(
                    provider=provider,
                    model=model,
                    status="ok",
                    duration_s=time.monotonic() - start,
                )
                return result

        return _call()

    # ── Subclass contract ───────────────────────────────────────────────

    @abstractmethod
    def process(self, *args: Any, **kwargs: Any) -> Any:
        """Primary work method implemented by subclasses.

        Subclasses run LLM calls via `self._run_chain(...)`, which applies
        resilience + telemetry. `process` itself is sync; use `invoke()`
        for an async-friendly entry point.
        """
        ...

    # ── Async adapter ────────────────────────────────────────────────────

    async def invoke(self, *args: Any, **kwargs: Any) -> Any:
        """Async adapter around `process()`.

        Runs the (sync) agent on a worker thread so the event loop stays
        responsive, under an OTel span with agent metrics. Resilience is
        not re-applied here — it already lives in `_run_chain`.
        """
        start = time.monotonic()
        async with traced_async_span(
            f"agent.{self.name}",
            **{
                "agent.name": self.name,
                "llm.provider": settings.default_llm_provider,
                "llm.model": settings.default_model,
            },
        ) as span:
            try:
                if asyncio.iscoroutinefunction(self.process):
                    result = await self.process(*args, **kwargs)
                else:
                    result = await asyncio.to_thread(self.process, *args, **kwargs)
            except Exception:
                metrics().agent_invocations_total.labels(agent=self.name, status="error").inc()
                raise

            duration = time.monotonic() - start
            metrics().agent_duration_seconds.labels(agent=self.name).observe(duration)
            metrics().agent_invocations_total.labels(agent=self.name, status="ok").inc()
            if span is not None:
                with contextlib.suppress(Exception):
                    span.set_attribute("agent.duration_ms", int(duration * 1000))
            return result

    # ── Error helper for subclasses ─────────────────────────────────────

    def _handle_error(self, error: Exception, context: dict[str, Any]) -> dict[str, Any]:
        """Build a uniform error envelope. Logging is structured + redacted."""
        self._logger.error("agent.error", error=str(error), context=context)
        return {
            "error": str(error),
            "agent": self.name,
            "context": context,
        }
