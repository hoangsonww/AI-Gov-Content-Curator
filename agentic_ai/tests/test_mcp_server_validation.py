from __future__ import annotations

from mcp_server.text_metrics import compute_text_metrics
from mcp_server.validation import sanitize_metadata


def test_sanitize_metadata_serializes_and_truncates_large_values(monkeypatch) -> None:
    monkeypatch.setattr("mcp_server.validation.settings.mcp_max_metadata_value_chars", 16)

    raw = {
        "number": 123,
        "flag": True,
        "nested": {"a": 1, "b": [1, 2, 3]},
        "huge": "x" * 100,
    }

    cleaned = sanitize_metadata(raw)

    assert cleaned["number"] == 123
    assert cleaned["flag"] is True
    assert isinstance(cleaned["nested"], str)
    assert len(cleaned["huge"]) == 16


def test_compute_text_metrics_returns_core_fields() -> None:
    text = "First sentence. Second sentence!\n\nThird sentence?"

    metrics = compute_text_metrics(text)

    assert metrics["char_count"] == len(text)
    assert metrics["word_count"] >= 6
    assert metrics["sentence_count"] == 3
    assert metrics["paragraph_count"] == 2
    assert metrics["estimated_reading_time_minutes"] >= 1
