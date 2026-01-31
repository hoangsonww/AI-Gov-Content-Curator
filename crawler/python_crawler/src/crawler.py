import logging
from collections import deque
from typing import Deque, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import aiohttp
from bs4 import BeautifulSoup

from .config import CrawlerConfig
from .extractor import extract_text_and_title
from .fetcher import fetch_dynamic, fetch_html
from .models import ArticleData
from .robots import RobotsCache
from .utils import compile_patterns, matches_patterns, normalize_url, should_skip_url

LOG = logging.getLogger("python_crawler")


def _normalize_allowed_domains(allowed: List[str], default_domain: str) -> Set[str]:
    raw_domains = allowed or [default_domain]
    normalized = set()
    for entry in raw_domains:
        if "://" in entry:
            normalized.add(urlparse(entry).netloc or entry)
        else:
            normalized.add(entry)
    return normalized


async def fetch_article(session: aiohttp.ClientSession, url: str, config: CrawlerConfig) -> Optional[ArticleData]:
    html = await fetch_html(session, url, config)

    if not html and config.js_fallback:
        html = await fetch_dynamic(url, config.user_agent)

    if not html:
        return None

    text, title = extract_text_and_title(html)

    if config.js_fallback and len(text) < config.min_text_length:
        js_html = await fetch_dynamic(url, config.user_agent)
        if js_html:
            js_text, js_title = extract_text_and_title(js_html)
            if len(js_text) > len(text):
                text = js_text
                title = js_title or title

    return ArticleData(url=url, title=title, content=text, source=url)


async def crawl_homepage(homepage_url: str, config: CrawlerConfig) -> List[str]:
    homepage_url = normalize_url(homepage_url)
    if not homepage_url:
        return []

    parsed_home = urlparse(homepage_url)
    domain = parsed_home.netloc

    allowed_domains = _normalize_allowed_domains(config.allowed_domains, domain)

    include_patterns = compile_patterns(config.include_patterns)
    exclude_patterns = compile_patterns(config.exclude_patterns)

    queue: Deque[Tuple[str, int]] = deque([(homepage_url, 0)])
    visited: Set[str] = set()
    collected: List[str] = []

    connector = aiohttp.TCPConnector(limit_per_host=config.concurrency)
    headers = {"User-Agent": config.user_agent, "Accept": "text/html,application/xhtml+xml"}

    robots = RobotsCache()

    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
        while queue and len(collected) < config.max_links:
            url, depth = queue.popleft()
            if url in visited:
                continue
            visited.add(url)

            if config.respect_robots:
                allowed = await robots.allowed(session, url, config.user_agent, config.request_timeout)
                if not allowed:
                    continue

            html = await fetch_html(session, url, config)
            if not html:
                continue

            soup = BeautifulSoup(html, "html.parser")
            found: List[str] = []
            for a in soup.find_all("a", href=True):
                href = normalize_url(urljoin(url, a["href"]))
                if not href or should_skip_url(href):
                    continue

                parsed = urlparse(href)
                if config.allow_subdomains:
                    if not any(parsed.netloc == d or parsed.netloc.endswith("." + d) for d in allowed_domains):
                        continue
                else:
                    if parsed.netloc not in allowed_domains:
                        continue

                if not matches_patterns(href, include_patterns, exclude_patterns):
                    continue

                if href != homepage_url:
                    found.append(href)

            for link in found:
                if link not in collected and len(collected) < config.max_links:
                    collected.append(link)

            if depth + 1 < config.max_depth:
                for link in found:
                    if link not in visited:
                        queue.append((link, depth + 1))

    return collected
