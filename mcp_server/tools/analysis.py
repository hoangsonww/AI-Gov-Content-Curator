"""Analysis-focused MCP tools."""
from __future__ import annotations

from typing import Any

from ..runtime import ServerRuntime
from ..text_metrics import compute_text_metrics as build_text_metrics
from ..validation import validate_content_size
from .common import ensure_runtime_ready, validation_error


def _render_summary_by_style(summary: str, style: str) -> str:
    normalized = style.strip().lower()
    cleaned = summary.strip()

    if normalized == "brief":
        return cleaned[:300].strip()

    if normalized == "bullet":
        segments = [segment.strip() for segment in cleaned.replace("\n", " ").split(".") if segment.strip()]
        bullets = [f"- {segment}." for segment in segments[:7]]
        return "\n".join(bullets) if bullets else cleaned

    if normalized == "executive":
        segments = [segment.strip() for segment in cleaned.replace("\n", " ").split(".") if segment.strip()]
        return " ".join([f"{segment}." for segment in segments[:3]])

    return cleaned


def register_analysis_tools(mcp, runtime: ServerRuntime, logger) -> None:
    @mcp.tool()
    async def analyze_content(content: str, analysis_type: str = "full") -> dict[str, Any]:
        """Run targeted analysis using one or more pipeline agents."""
        mode = analysis_type.strip().lower()
        pipeline, readiness_error = ensure_runtime_ready(runtime)
        if readiness_error:
            return readiness_error

        if not content.strip():
            return validation_error("content", "required")

        size_error = validate_content_size(content)
        if size_error:
            return validation_error("content", size_error)

        if mode == "content":
            return pipeline.content_analyzer.analyze(content)

        if mode == "sentiment":
            return pipeline.sentiment_analyzer.analyze_sentiment(content)

        if mode == "classification":
            return {"topics": pipeline.classifier.classify(content)}

        if mode == "summary":
            return {"summary": pipeline.summarizer.summarize(content)}

        if mode == "quality":
            summary = pipeline.summarizer.summarize(content)
            topics = pipeline.classifier.classify(content, summary=summary)
            sentiment = pipeline.sentiment_analyzer.analyze_sentiment(content, summary=summary)
            quality = pipeline.quality_checker.check_quality(content, summary, topics, sentiment)
            return {
                "summary": summary,
                "topics": topics,
                "sentiment": sentiment,
                "quality": quality,
            }

        if mode == "full":
            content_analysis = pipeline.content_analyzer.analyze(content)
            summary = pipeline.summarizer.summarize(content, analyzed_content=content_analysis)
            topics = pipeline.classifier.classify(content, summary=summary)
            sentiment = pipeline.sentiment_analyzer.analyze_sentiment(content, summary=summary)
            quality = pipeline.quality_checker.check_quality(content, summary, topics, sentiment)
            return {
                "content_analysis": content_analysis,
                "summary": summary,
                "topics": topics,
                "sentiment": sentiment,
                "quality": quality,
                "text_metrics": build_text_metrics(content),
            }

        return validation_error(
            "analysis_type",
            "use one of: content, sentiment, classification, summary, quality, full",
        )

    @mcp.tool()
    async def analyze_sentiment(content: str, summary: str = "") -> dict[str, Any]:
        """Analyze sentiment independently with optional summary context."""
        pipeline, readiness_error = ensure_runtime_ready(runtime)
        if readiness_error:
            return readiness_error

        if not content.strip():
            return validation_error("content", "required")

        size_error = validate_content_size(content)
        if size_error:
            return validation_error("content", size_error)

        return pipeline.sentiment_analyzer.analyze_sentiment(content, summary=summary or None)

    @mcp.tool()
    async def extract_topics(content: str, summary: str = "") -> dict[str, Any]:
        """Classify content into policy/news topics."""
        pipeline, readiness_error = ensure_runtime_ready(runtime)
        if readiness_error:
            return readiness_error

        if not content.strip():
            return validation_error("content", "required")

        size_error = validate_content_size(content)
        if size_error:
            return validation_error("content", size_error)

        topics = pipeline.classifier.classify(content, summary=summary or None)
        return {
            "topics": topics,
            "topic_count": len(topics),
        }

    @mcp.tool()
    async def evaluate_quality(
        content: str,
        summary: str = "",
        topics: list[str] | None = None,
        sentiment: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Score quality/coherence of generated outputs against source content."""
        pipeline, readiness_error = ensure_runtime_ready(runtime)
        if readiness_error:
            return readiness_error

        if not content.strip():
            return validation_error("content", "required")

        size_error = validate_content_size(content)
        if size_error:
            return validation_error("content", size_error)

        generated_summary = summary.strip() or pipeline.summarizer.summarize(content)
        generated_topics = topics or pipeline.classifier.classify(content, summary=generated_summary)
        generated_sentiment = sentiment or pipeline.sentiment_analyzer.analyze_sentiment(
            content,
            summary=generated_summary,
        )

        quality = pipeline.quality_checker.check_quality(
            original_content=content,
            summary=generated_summary,
            topics=generated_topics,
            sentiment=generated_sentiment,
        )

        logger.info(
            "tool.evaluate_quality.complete",
            score=quality.get("score"),
            passed=quality.get("passed"),
        )

        return {
            "quality": quality,
            "inputs": {
                "summary": generated_summary,
                "topics": generated_topics,
                "sentiment": generated_sentiment,
            },
        }

    @mcp.tool()
    async def compute_text_metrics(content: str) -> dict[str, Any]:
        """Compute readability and size metrics for an article payload."""
        if not content.strip():
            return validation_error("content", "required")

        size_error = validate_content_size(content)
        metrics = build_text_metrics(content)

        return {
            "metrics": metrics,
            "within_size_limits": size_error is None,
            "size_error": size_error,
        }

    @mcp.tool()
    async def generate_summary(content: str, style: str = "standard") -> str:
        """Generate article summary with style variants (standard/brief/bullet/executive)."""
        pipeline, readiness_error = ensure_runtime_ready(runtime)
        if readiness_error:
            return (
                f"Error: {readiness_error['message']}; "
                f"startup_error={readiness_error['readiness'].get('startup_error')}"
            )

        if not content.strip():
            return "Error: content is required"

        size_error = validate_content_size(content)
        if size_error:
            return f"Error: {size_error}"

        summary = pipeline.summarizer.summarize(content)
        return _render_summary_by_style(summary, style)
