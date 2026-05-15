"""End-to-end tests for the LangGraph pipeline.

These exercise `AgenticPipeline.process_article` with the agent methods
stubbed, so the full graph runs (intake → content analysis →
summarization → classification → sentiment → quality → output, including
the quality-retry loop) without any real LLM calls.
"""

from __future__ import annotations

from typing import Any

import pytest

pytestmark = pytest.mark.asyncio


def _build_pipeline(monkeypatch: pytest.MonkeyPatch, *, quality_score: float) -> Any:
    """Construct a pipeline whose agents return canned, deterministic output."""
    from langchain_core.language_models.fake_chat_models import FakeListChatModel

    # Agents build `prompt | llm | parser` at construction; give them a
    # real (but never-invoked) fake Runnable so __init__ succeeds.
    monkeypatch.setattr(
        "agentic_ai.agents.base_agent.BaseAgent._get_default_llm",
        lambda self: FakeListChatModel(responses=["{}"]),
    )

    from agentic_ai.core.pipeline import AgenticPipeline

    pipeline = AgenticPipeline()

    calls: dict[str, int] = {
        "content": 0,
        "summary": 0,
        "topics": 0,
        "sentiment": 0,
        "quality": 0,
    }

    def _content(content: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        calls["content"] += 1
        return {"main_topic": "infrastructure", "entities": {"people": []}}

    def _summary(content: str, analyzed_content: dict[str, Any] | None = None) -> str:
        calls["summary"] += 1
        return "A concise summary of the article."

    def _topics(content: str, summary: str | None = None) -> list[str]:
        calls["topics"] += 1
        return ["policy", "infrastructure"]

    def _sentiment(content: str, summary: str | None = None) -> dict[str, Any]:
        calls["sentiment"] += 1
        return {"overall_sentiment": "neutral", "sentiment_score": 0.0}

    def _quality(**kwargs: Any) -> dict[str, Any]:
        calls["quality"] += 1
        return {"score": quality_score, "passed": quality_score >= 0.7}

    pipeline.content_analyzer.analyze = _content  # type: ignore[method-assign]
    pipeline.summarizer.summarize = _summary  # type: ignore[method-assign]
    pipeline.classifier.classify = _topics  # type: ignore[method-assign]
    pipeline.sentiment_analyzer.analyze_sentiment = _sentiment  # type: ignore[method-assign]
    pipeline.quality_checker.check_quality = _quality  # type: ignore[method-assign]

    pipeline._test_calls = calls  # type: ignore[attr-defined]
    return pipeline


async def test_process_article_happy_path(
    monkeypatch: pytest.MonkeyPatch, fresh_metrics_registry: Any
) -> None:
    pipeline = _build_pipeline(monkeypatch, quality_score=0.95)

    result = await pipeline.process_article(
        {
            "id": "article-1",
            "content": "Government announces new infrastructure policy.",
            "url": "https://example.gov/news/1",
            "source": "example.gov",
        }
    )

    assert result["article_id"] == "article-1"
    assert result["summary"] == "A concise summary of the article."
    assert result["topics"] == ["policy", "infrastructure"]
    assert result["sentiment"]["overall_sentiment"] == "neutral"
    assert result["quality_score"] == 0.95
    assert result["errors"] == []
    # Each stage ran exactly once on the happy path.
    assert pipeline._test_calls["content"] == 1
    assert pipeline._test_calls["quality"] == 1


async def test_process_article_low_quality_retries_then_terminates(
    monkeypatch: pytest.MonkeyPatch, fresh_metrics_registry: Any
) -> None:
    """A persistently low quality score must loop, then stop at max_iterations."""
    pipeline = _build_pipeline(monkeypatch, quality_score=0.1)

    result = await pipeline.process_article({"id": "article-2", "content": "Short article body."})

    # The graph terminated (did not hang) and produced a result.
    assert result["article_id"] == "article-2"
    assert "error" not in result
    # The quality gate ran more than once because the score stayed low.
    assert pipeline._test_calls["quality"] >= 2
    # ... but bounded — content analysis cannot exceed max_iterations runs.
    from agentic_ai.config.settings import settings

    assert pipeline._test_calls["content"] <= settings.max_iterations + 1


async def test_process_article_records_metrics(
    monkeypatch: pytest.MonkeyPatch, fresh_metrics_registry: Any
) -> None:
    pipeline = _build_pipeline(monkeypatch, quality_score=0.9)
    m = fresh_metrics_registry

    await pipeline.process_article({"id": "article-3", "content": "Body text."})

    completed = m.pipeline_runs_total.labels(status="completed")._value.get()
    assert completed == 1.0


async def test_process_article_stage_failure_is_captured(
    monkeypatch: pytest.MonkeyPatch, fresh_metrics_registry: Any
) -> None:
    """An exception in one stage is captured in errors[], pipeline continues."""
    pipeline = _build_pipeline(monkeypatch, quality_score=0.9)

    def _boom(content: str, summary: str | None = None) -> dict[str, Any]:
        raise RuntimeError("sentiment model exploded")

    pipeline.sentiment_analyzer.analyze_sentiment = _boom  # type: ignore[method-assign]

    result = await pipeline.process_article({"id": "article-4", "content": "Body text."})

    # Pipeline completed despite the stage failure.
    assert result["article_id"] == "article-4"
    assert any("sentiment" in e for e in result["errors"])
    # Summary still produced (summarization ran before the failing stage).
    assert result["summary"] == "A concise summary of the article."


async def test_visualize_returns_mermaid(
    monkeypatch: pytest.MonkeyPatch, fresh_metrics_registry: Any
) -> None:
    pipeline = _build_pipeline(monkeypatch, quality_score=0.9)
    graph = pipeline.visualize()
    assert isinstance(graph, str)
    assert len(graph) > 0
