"""Tests for LLM cost estimation."""

from __future__ import annotations

import pytest

from mcp_server.cost import ModelPrice, estimate_cost_usd, register_pricing


def test_unknown_model_returns_zero() -> None:
    assert estimate_cost_usd(model="fictional", prompt_tokens=100, completion_tokens=100) == 0.0


def test_known_model_calculates() -> None:
    cost = estimate_cost_usd(
        model="gpt-4o-mini",
        prompt_tokens=1_000_000,
        completion_tokens=1_000_000,
    )
    # 0.15 + 0.60 = 0.75 USD
    assert cost == pytest.approx(0.75, rel=1e-6)


def test_case_insensitive_lookup() -> None:
    assert estimate_cost_usd(model="GPT-4O", prompt_tokens=1, completion_tokens=1) > 0.0


def test_register_custom_pricing() -> None:
    register_pricing("custom-model", ModelPrice(1.0, 2.0))
    cost = estimate_cost_usd(
        model="custom-model",
        prompt_tokens=1_000_000,
        completion_tokens=1_000_000,
    )
    assert cost == pytest.approx(3.0, rel=1e-6)
