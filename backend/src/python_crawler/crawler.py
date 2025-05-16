import asyncio
from urllib.parse import urljoin, urlparse
from typing import List, Set, Tuple
import aiohttp
from bs4 import BeautifulSoup
from dataclasses import dataclass
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/112.0.0.0 Safari/537.36"
)
FETCH_TIMEOUT = 10  # seconds
RETRY_DELAY = 2     # seconds


@dataclass
class ArticleData:
    url: str
    title: str
    content: str
    source: str


async def fetch_static(url: str, session: aiohttp.ClientSession, retries: int = 3) -> ArticleData:
    """
    Try a static fetch via HTTP + BeautifulSoup.
    On 403 or timeout, may retry or bubble up.
    """
    try:
        async with session.get(url, timeout=FETCH_TIMEOUT) as resp:
            if resp.status == 403:
                raise aiohttp.ClientResponseError(
                    status=403, request_info=resp.request_info, history=()
                )
            text = await resp.text()
    except (asyncio.TimeoutError, aiohttp.ClientError) as e:
        if retries > 0:
            await asyncio.sleep(RETRY_DELAY)
            return await fetch_static(url, session, retries - 1)
        raise

    soup = BeautifulSoup(text, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title else "Untitled"
    content = soup.get_text(separator="\n").strip()
    return ArticleData(url=url, title=title, content=content, source=url)


async def fetch_dynamic(url: str) -> ArticleData:
    """
    Use Playwright to load JS-rendered pages.
    First waits for `networkidle`, then falls back to `domcontentloaded`.
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page(user_agent=USER_AGENT)

        try:
            await page.goto(url, wait_until="networkidle", timeout=15000)
        except PlaywrightTimeoutError:
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            except PlaywrightTimeoutError as e:
                await browser.close()
                raise

        html = await page.content()
        await browser.close()

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title else "Untitled"
    content = soup.get_text(separator="\n").strip()
    return ArticleData(url=url, title=title, content=content, source=url)


async def crawl_homepage(
    homepage_url: str, max_links: int = 20, max_depth: int = 1
) -> List[str]:
    """
    Multi‐level BFS crawl on same‐host links up to max_depth, collecting up to max_links.
    """
    queue: List[Tuple[str, int]] = [(homepage_url, 0)]
    visited: Set[str] = set()
    collected: List[str] = []
    domain = urlparse(homepage_url).netloc

    connector = aiohttp.TCPConnector(limit_per_host=5)
    async with aiohttp.ClientSession(
        connector=connector, headers={"User-Agent": USER_AGENT}
    ) as session:
        while queue and len(collected) < max_links:
            url, depth = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)
            try:
                async with session.get(url, timeout=FETCH_TIMEOUT) as resp:
                    html = await resp.text()
            except Exception:
                continue

            soup = BeautifulSoup(html, "html.parser")
            found: List[str] = []
            for a in soup.find_all("a", href=True):
                href = urljoin(url, a["href"])
                parsed = urlparse(href)
                if parsed.netloc == domain and href != homepage_url:
                    found.append(href)

            for link in found:
                if len(collected) < max_links and link not in collected:
                    collected.append(link)

            if depth + 1 < max_depth:
                for link in found:
                    if link not in visited:
                        queue.append((link, depth + 1))

    return collected
