"""Hermetic tests for the python_crawler subsystem.

No network, no Playwright, no real LLM calls. Async helpers that touch the
network are exercised with stubbed sessions.
"""

from __future__ import annotations

import asyncio
import re
from typing import Any

import pytest

from src import cli
from src.config import SKIP_EXTENSIONS, CrawlerConfig
from src.crawler import _normalize_allowed_domains
from src.extractor import extract_text_and_title
from src.models import ArticleData
from src.robots import RobotsCache
from src.summarizer import _chunk_text, _extractive_summary, summarize_content
from src.utils import (
    compile_patterns,
    matches_patterns,
    normalize_url,
    should_skip_url,
)

# ---------------------------------------------------------------------------
# utils.normalize_url
# ---------------------------------------------------------------------------


class TestNormalizeUrl:
    def test_empty_string_returns_empty(self) -> None:
        assert normalize_url("") == ""
        assert normalize_url("   ") == ""

    def test_strips_fragment(self) -> None:
        assert normalize_url("http://x.com/a#section") == "http://x.com/a"

    def test_lowercases_scheme_and_host(self) -> None:
        assert normalize_url("HTTP://Example.COM/Path") == "http://example.com/Path"

    def test_defaults_scheme_to_http(self) -> None:
        assert normalize_url("//example.com/a").startswith("http://example.com")

    def test_rejects_non_http_scheme(self) -> None:
        assert normalize_url("ftp://x.com/file") == ""
        assert normalize_url("mailto:a@b.com") == ""
        assert normalize_url("javascript:alert(1)") == ""

    def test_drops_default_ports(self) -> None:
        assert normalize_url("http://x.com:80/a") == "http://x.com/a"
        assert normalize_url("https://x.com:443/a") == "https://x.com/a"

    def test_keeps_non_default_port(self) -> None:
        assert "8080" in normalize_url("http://x.com:8080/a")

    def test_collapses_duplicate_slashes(self) -> None:
        assert normalize_url("http://x.com/a//b///c") == "http://x.com/a/b/c"

    def test_preserves_query(self) -> None:
        assert normalize_url("http://x.com/a?q=1&p=2") == "http://x.com/a?q=1&p=2"

    def test_empty_path_becomes_root(self) -> None:
        assert normalize_url("http://x.com") == "http://x.com/"


# ---------------------------------------------------------------------------
# utils.should_skip_url
# ---------------------------------------------------------------------------


class TestShouldSkipUrl:
    def test_skips_non_http_scheme(self) -> None:
        assert should_skip_url("ftp://x.com/a") is True

    def test_skips_known_binary_extensions(self) -> None:
        for ext in (".png", ".pdf", ".zip", ".mp4", ".css", ".js"):
            assert should_skip_url(f"http://x.com/file{ext}") is True

    def test_allows_html_pages(self) -> None:
        assert should_skip_url("http://x.com/article") is False
        assert should_skip_url("http://x.com/news/story.html") is False

    def test_every_skip_extension_is_skipped(self) -> None:
        for ext in SKIP_EXTENSIONS:
            assert should_skip_url(f"https://x.com/a{ext}") is True


# ---------------------------------------------------------------------------
# utils.compile_patterns / matches_patterns
# ---------------------------------------------------------------------------


class TestPatterns:
    def test_compile_patterns_is_case_insensitive(self) -> None:
        compiled = compile_patterns(["NEWS"])
        assert compiled[0].search("http://x.com/news/1")

    def test_compile_empty_iterable(self) -> None:
        assert compile_patterns([]) == []

    def test_no_includes_no_excludes_matches_all(self) -> None:
        assert matches_patterns("http://x.com/a", [], []) is True

    def test_exclude_takes_precedence(self) -> None:
        excludes = compile_patterns([r"/tag/"])
        assert matches_patterns("http://x.com/tag/news", [], excludes) is False

    def test_include_must_match_when_present(self) -> None:
        includes = compile_patterns([r"/article/"])
        assert matches_patterns("http://x.com/article/1", includes, []) is True
        assert matches_patterns("http://x.com/video/1", includes, []) is False

    def test_exclude_beats_include(self) -> None:
        includes = compile_patterns([r"/news/"])
        excludes = compile_patterns([r"/news/sports/"])
        assert matches_patterns("http://x.com/news/sports/1", includes, excludes) is False


# ---------------------------------------------------------------------------
# config.CrawlerConfig
# ---------------------------------------------------------------------------


class TestCrawlerConfig:
    def test_defaults(self) -> None:
        cfg = CrawlerConfig()
        assert cfg.max_links == 20
        assert cfg.max_depth == 1
        assert cfg.concurrency == 5
        assert cfg.respect_robots is True
        assert cfg.js_fallback is True

    def test_list_fields_are_independent_instances(self) -> None:
        a = CrawlerConfig()
        b = CrawlerConfig()
        a.allowed_domains.append("x.com")
        assert b.allowed_domains == []

    def test_overrides_apply(self) -> None:
        cfg = CrawlerConfig(max_links=5, respect_robots=False)
        assert cfg.max_links == 5
        assert cfg.respect_robots is False


# ---------------------------------------------------------------------------
# models.ArticleData
# ---------------------------------------------------------------------------


class TestArticleData:
    def test_required_and_default_fields(self) -> None:
        art = ArticleData(url="u", title="t", content="c", source="s")
        assert art.summary == ""
        assert art.fetched_at == ""

    def test_dict_serialization(self) -> None:
        art = ArticleData(url="u", title="t", content="c", source="s", summary="sum")
        assert art.__dict__["summary"] == "sum"


# ---------------------------------------------------------------------------
# crawler._normalize_allowed_domains
# ---------------------------------------------------------------------------


class TestNormalizeAllowedDomains:
    def test_falls_back_to_default_when_empty(self) -> None:
        assert _normalize_allowed_domains([], "example.com") == {"example.com"}

    def test_strips_scheme_from_entries(self) -> None:
        result = _normalize_allowed_domains(["https://a.com", "b.com"], "default.com")
        assert result == {"a.com", "b.com"}

    def test_explicit_list_overrides_default(self) -> None:
        result = _normalize_allowed_domains(["only.com"], "default.com")
        assert "default.com" not in result


# ---------------------------------------------------------------------------
# extractor.extract_text_and_title
# ---------------------------------------------------------------------------


class TestExtractor:
    def test_extracts_title_and_text(self) -> None:
        html = (
            "<html><head><title>My Title</title></head><body><p>Body text here.</p></body></html>"
        )
        text, title = extract_text_and_title(html)
        assert "Body text here." in text
        assert "My Title" in title

    def test_strips_script_and_style(self) -> None:
        html = (
            "<html><body><script>evil()</script>"
            "<style>.x{}</style><p>Real content.</p></body></html>"
        )
        text, _ = extract_text_and_title(html)
        assert "evil()" not in text
        assert ".x{}" not in text
        assert "Real content." in text

    def test_missing_title_falls_back(self) -> None:
        text, title = extract_text_and_title("<html><body><p>No title here.</p></body></html>")
        assert title == "Untitled"
        assert "No title here." in text

    def test_handles_empty_html(self) -> None:
        text, title = extract_text_and_title("")
        assert title == "Untitled"
        assert text == ""


# ---------------------------------------------------------------------------
# summarizer — chunking + extractive fallback
# ---------------------------------------------------------------------------


class TestChunkText:
    def test_short_text_single_chunk(self) -> None:
        assert _chunk_text("short", 100) == ["short"]

    def test_long_text_splits(self) -> None:
        chunks = _chunk_text("a" * 250, 100)
        assert len(chunks) == 3
        assert "".join(chunks) == "a" * 250

    def test_exact_boundary(self) -> None:
        assert _chunk_text("a" * 100, 100) == ["a" * 100]


class TestExtractiveSummary:
    def test_returns_first_n_sentences(self) -> None:
        text = "One. Two. Three. Four. Five. Six. Seven. Eight."
        summary = _extractive_summary(text, max_sentences=3)
        assert "One." in summary and "Three." in summary
        assert "Eight." not in summary

    def test_short_text_unchanged(self) -> None:
        assert _extractive_summary("Only one sentence.") == "Only one sentence."

    def test_empty_text(self) -> None:
        assert _extractive_summary("") == ""


class TestSummarizeContent:
    def test_empty_content_returns_empty(self) -> None:
        assert summarize_content("") == ""

    def test_falls_back_to_extractive_without_api_key(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Force the no-API-key path regardless of the environment.
        monkeypatch.setattr("src.summarizer.API_KEY", None)
        text = "First sentence. Second sentence. Third sentence."
        result = summarize_content(text)
        assert "First sentence." in result

    def test_falls_back_when_genai_unavailable(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr("src.summarizer.genai", None)
        result = summarize_content("Alpha. Beta. Gamma.")
        assert "Alpha." in result


# ---------------------------------------------------------------------------
# robots.RobotsCache  (stubbed aiohttp session)
# ---------------------------------------------------------------------------


class _FakeResponse:
    def __init__(self, status: int, body: str) -> None:
        self.status = status
        self._body = body

    async def __aenter__(self) -> "_FakeResponse":
        return self

    async def __aexit__(self, *_: Any) -> None:
        return None

    async def text(self) -> str:
        return self._body


class _FakeSession:
    def __init__(self, status: int = 200, body: str = "") -> None:
        self._status = status
        self._body = body
        self.calls = 0

    def get(self, _url: str, **_kwargs: Any) -> _FakeResponse:
        self.calls += 1
        return _FakeResponse(self._status, self._body)


class TestRobotsCache:
    @pytest.mark.asyncio
    async def test_allows_when_robots_permits(self) -> None:
        session = _FakeSession(status=200, body="User-agent: *\nAllow: /")
        cache = RobotsCache()
        allowed = await cache.allowed(session, "http://x.com/page", "bot", 5)  # type: ignore[arg-type]
        assert allowed is True

    @pytest.mark.asyncio
    async def test_disallows_blocked_path(self) -> None:
        session = _FakeSession(status=200, body="User-agent: *\nDisallow: /private")
        cache = RobotsCache()
        allowed = await cache.allowed(
            session,  # type: ignore[arg-type]
            "http://x.com/private/secret",
            "bot",
            5,
        )
        assert allowed is False

    @pytest.mark.asyncio
    async def test_missing_robots_allows(self) -> None:
        session = _FakeSession(status=404, body="")
        cache = RobotsCache()
        allowed = await cache.allowed(session, "http://x.com/a", "bot", 5)  # type: ignore[arg-type]
        assert allowed is True

    @pytest.mark.asyncio
    async def test_result_is_cached_per_host(self) -> None:
        session = _FakeSession(status=200, body="User-agent: *\nAllow: /")
        cache = RobotsCache()
        await cache.allowed(session, "http://x.com/a", "bot", 5)  # type: ignore[arg-type]
        await cache.allowed(session, "http://x.com/b", "bot", 5)  # type: ignore[arg-type]
        # Second lookup for the same host must not refetch robots.txt.
        assert session.calls == 1


# ---------------------------------------------------------------------------
# pattern compilation is a real regex
# ---------------------------------------------------------------------------


def test_compile_patterns_returns_compiled_regex() -> None:
    compiled = compile_patterns([r"\d+"])
    assert isinstance(compiled[0], re.Pattern)


# ---------------------------------------------------------------------------
# cli.fetch_and_process — single-URL failures must not abort the batch
# ---------------------------------------------------------------------------


class TestFetchAndProcessResilience:
    @pytest.mark.asyncio
    async def test_swallows_fetch_exception(self, monkeypatch: pytest.MonkeyPatch) -> None:
        async def _boom(*_args: Any, **_kwargs: Any) -> Any:
            raise RuntimeError("browser launch failed")

        monkeypatch.setattr(cli, "fetch_article", _boom)
        result = await cli.fetch_and_process(
            session=None,  # type: ignore[arg-type]
            url="http://x.com/a",
            semaphore=asyncio.Semaphore(1),
            config=CrawlerConfig(),
            summarize=False,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_no_article(self, monkeypatch: pytest.MonkeyPatch) -> None:
        async def _none(*_args: Any, **_kwargs: Any) -> Any:
            return None

        monkeypatch.setattr(cli, "fetch_article", _none)
        result = await cli.fetch_and_process(
            session=None,  # type: ignore[arg-type]
            url="http://x.com/a",
            semaphore=asyncio.Semaphore(1),
            config=CrawlerConfig(),
            summarize=False,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_summarization_failure_is_non_fatal(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        async def _article(*_args: Any, **_kwargs: Any) -> ArticleData:
            return ArticleData(url="u", title="t", content="body text", source="u")

        def _boom(_content: str) -> str:
            raise RuntimeError("summarizer down")

        monkeypatch.setattr(cli, "fetch_article", _article)
        monkeypatch.setattr(cli, "summarize_content", _boom)
        result = await cli.fetch_and_process(
            session=None,  # type: ignore[arg-type]
            url="http://x.com/a",
            semaphore=asyncio.Semaphore(1),
            config=CrawlerConfig(),
            summarize=True,
        )
        assert result is not None
        assert result.summary == ""
        assert result.fetched_at != ""
