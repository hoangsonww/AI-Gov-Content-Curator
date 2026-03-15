#!/usr/bin/env python3

import argparse
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import aiohttp
from dotenv import load_dotenv

from .config import CrawlerConfig
from .crawler import crawl_homepage, fetch_article
from .models import ArticleData
from .summarizer import summarize_content

load_dotenv()

LOG_LEVEL = os.getenv("CRAWLER_LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s %(levelname)s %(message)s")
LOG = logging.getLogger("python_crawler")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def fetch_and_process(
    session: aiohttp.ClientSession,
    url: str,
    semaphore: asyncio.Semaphore,
    config: CrawlerConfig,
    summarize: bool,
) -> Optional[ArticleData]:
    async with semaphore:
        article = await fetch_article(session, url, config)
        if not article:
            return None

        article.fetched_at = _utc_now()

        if summarize:
            try:
                article.summary = summarize_content(article.content)
            except Exception as exc:
                LOG.warning("Summarization failed for %s: %s", url, exc)
        return article


async def main() -> None:
    parser = argparse.ArgumentParser(description="Production-ready async crawler")
    parser.add_argument("homepage_url", help="Start URL to crawl")
    parser.add_argument("--max-links", type=int, default=50, help="Max links to fetch")
    parser.add_argument("--depth", type=int, default=2, help="Max crawl depth")
    parser.add_argument("--concurrency", type=int, default=8, help="Parallel fetch slots")
    parser.add_argument("--output", default="articles.json", help="Output filepath")
    parser.add_argument("--output-format", choices=["json", "jsonl"], default="json")
    parser.add_argument("--allowed-domain", action="append", default=[], help="Allowed domain (repeatable)")
    parser.add_argument("--include", action="append", default=[], help="Include URL regex (repeatable)")
    parser.add_argument("--exclude", action="append", default=[], help="Exclude URL regex (repeatable)")
    parser.add_argument("--no-robots", action="store_true", help="Ignore robots.txt")
    parser.add_argument("--request-delay", type=float, default=0.2, help="Delay between requests (seconds)")
    parser.add_argument("--timeout", type=int, default=12, help="Request timeout (seconds)")
    parser.add_argument("--max-retries", type=int, default=3, help="Max retries per request")
    parser.add_argument("--no-js-fallback", action="store_true", help="Disable Playwright fallback")
    parser.add_argument("--min-text-length", type=int, default=600, help="Minimum extracted text length")
    parser.add_argument("--no-summarize", action="store_true", help="Disable AI summarization")
    args = parser.parse_args()

    config = CrawlerConfig(
        max_links=args.max_links,
        max_depth=args.depth,
        concurrency=args.concurrency,
        request_timeout=args.timeout,
        request_delay=args.request_delay,
        max_retries=args.max_retries,
        respect_robots=not args.no_robots,
        js_fallback=not args.no_js_fallback,
        min_text_length=args.min_text_length,
        allowed_domains=args.allowed_domain,
        include_patterns=args.include,
        exclude_patterns=args.exclude,
    )

    LOG.info("Crawling %s (depth=%s, max_links=%s)", args.homepage_url, args.depth, args.max_links)
    urls = await crawl_homepage(args.homepage_url, config)
    LOG.info("Discovered %d candidate URLs", len(urls))

    headers = {"User-Agent": config.user_agent, "Accept": "text/html,application/xhtml+xml"}
    connector = aiohttp.TCPConnector(limit_per_host=config.concurrency)

    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
        sem = asyncio.Semaphore(config.concurrency)
        tasks = [fetch_and_process(session, url, sem, config, not args.no_summarize) for url in urls]
        results = await asyncio.gather(*tasks)

    articles = [article.__dict__ for article in results if article]

    if args.output_format == "jsonl":
        with open(args.output, "w", encoding="utf-8") as f:
            for article in articles:
                f.write(json.dumps(article, ensure_ascii=False) + "\n")
    else:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(articles, f, ensure_ascii=False, indent=2)

    LOG.info("Wrote %d articles to %s", len(articles), args.output)


if __name__ == "__main__":
    asyncio.run(main())
