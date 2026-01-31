import asyncio
import logging
import random
from typing import Optional

import aiohttp

from .config import CrawlerConfig

try:
    from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
except Exception:  # pragma: no cover
    async_playwright = None
    PlaywrightTimeoutError = Exception

LOG = logging.getLogger("python_crawler")


async def fetch_dynamic(url: str, user_agent: str) -> Optional[str]:
    if async_playwright is None:
        return None

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page(user_agent=user_agent)
        try:
            await page.goto(url, wait_until="networkidle", timeout=20000)
        except PlaywrightTimeoutError:
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            except PlaywrightTimeoutError:
                await browser.close()
                return None

        html = await page.content()
        await browser.close()
        return html


async def fetch_html(
    session: aiohttp.ClientSession,
    url: str,
    config: CrawlerConfig,
) -> Optional[str]:
    timeout = aiohttp.ClientTimeout(total=config.request_timeout)

    for attempt in range(config.max_retries + 1):
        if config.request_delay > 0:
            await asyncio.sleep(config.request_delay)
        try:
            async with session.get(url, timeout=timeout) as resp:
                if resp.status in {403, 429, 500, 502, 503, 504}:
                    raise aiohttp.ClientResponseError(
                        status=resp.status,
                        request_info=resp.request_info,
                        history=resp.history,
                    )
                content_type = resp.headers.get("Content-Type", "")
                if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
                    return None
                return await resp.text()
        except (asyncio.TimeoutError, aiohttp.ClientError) as exc:
            if attempt >= config.max_retries:
                LOG.warning("Fetch failed for %s: %s", url, exc)
                return None
            backoff = config.backoff_base * (2 ** attempt) + random.uniform(0, 0.3)
            await asyncio.sleep(backoff)

    return None
