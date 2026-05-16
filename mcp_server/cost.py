"""LLM cost estimation.

Reference table of public per-million-token prices. Always an estimate —
real billing comes from the provider. Used for budget enforcement and
the `cost_usd` span attribute on LLM spans.

Update by editing `MODEL_PRICING` below or via `register_pricing()`.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelPrice:
    """Per-million-token pricing for a model."""

    prompt_usd_per_million: float
    completion_usd_per_million: float


# Canonical defaults. Public list price as of authoring time. Override with
# `register_pricing()` to keep estimates current per environment.
MODEL_PRICING: dict[str, ModelPrice] = {
    # OpenAI
    "gpt-4o": ModelPrice(2.50, 10.00),
    "gpt-4o-mini": ModelPrice(0.15, 0.60),
    "gpt-4-turbo": ModelPrice(10.00, 30.00),
    "gpt-3.5-turbo": ModelPrice(0.50, 1.50),
    # Anthropic
    "claude-opus-4": ModelPrice(15.00, 75.00),
    "claude-sonnet-4": ModelPrice(3.00, 15.00),
    "claude-haiku-4": ModelPrice(0.80, 4.00),
    "claude-3-5-sonnet": ModelPrice(3.00, 15.00),
    "claude-3-haiku": ModelPrice(0.25, 1.25),
    # Google
    "gemini-1.5-flash": ModelPrice(0.075, 0.30),
    "gemini-1.5-pro": ModelPrice(1.25, 5.00),
    # Cohere
    "command-r-plus": ModelPrice(2.50, 10.00),
    "command-r": ModelPrice(0.50, 1.50),
}


def register_pricing(model: str, price: ModelPrice) -> None:
    MODEL_PRICING[model.lower()] = price


def estimate_cost_usd(
    *,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> float:
    """Estimate USD cost for an LLM call. Returns 0.0 if model unknown."""
    price = MODEL_PRICING.get(model.lower())
    if price is None:
        return 0.0
    return (prompt_tokens / 1_000_000.0) * price.prompt_usd_per_million + (
        completion_tokens / 1_000_000.0
    ) * price.completion_usd_per_million
