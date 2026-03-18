"""Lightweight content metrics for diagnostics and preflight checks."""
from __future__ import annotations

import re
from typing import Any


_WORD_RE = re.compile(r"\b[\w'-]+\b")
_SENTENCE_RE = re.compile(r"[^.!?]+[.!?]?")


def compute_text_metrics(content: str) -> dict[str, Any]:
    stripped = content.strip()
    words = _WORD_RE.findall(stripped)
    sentences = [s.strip() for s in _SENTENCE_RE.findall(stripped) if s.strip()]
    paragraphs = [p for p in stripped.split("\n\n") if p.strip()]

    word_count = len(words)
    sentence_count = len(sentences)
    paragraph_count = len(paragraphs)
    char_count = len(content)
    char_count_no_whitespace = len("".join(content.split()))
    avg_word_length = (
        round(sum(len(word) for word in words) / word_count, 2) if word_count > 0 else 0.0
    )
    avg_sentence_length_words = (
        round(word_count / sentence_count, 2) if sentence_count > 0 else 0.0
    )
    unique_word_ratio = (
        round(len({word.lower() for word in words}) / word_count, 3) if word_count > 0 else 0.0
    )

    reading_time_minutes = max(1, round(word_count / 220)) if word_count > 0 else 0

    return {
        "char_count": char_count,
        "char_count_no_whitespace": char_count_no_whitespace,
        "word_count": word_count,
        "sentence_count": sentence_count,
        "paragraph_count": paragraph_count,
        "avg_word_length": avg_word_length,
        "avg_sentence_length_words": avg_sentence_length_words,
        "unique_word_ratio": unique_word_ratio,
        "estimated_reading_time_minutes": reading_time_minutes,
    }
