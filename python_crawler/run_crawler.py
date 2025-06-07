#!/usr/bin/env python3

import os
import json
import argparse
import asyncio
import aiohttp
from dotenv import load_dotenv

from crawler import crawl_homepage, fetch_static, fetch_dynamic, ArticleData
from summarizer import summarize_content

load_dotenv()


async def fetch_and_summarize(
    session: aiohttp.ClientSession, url: str, semaphore: asyncio.Semaphore
) -> ArticleData:
    async with semaphore:
        try:
            article = await fetch_static(url, session)
        except Exception:
            article = await fetch_dynamic(url)

        try:
            article.content = summarize_content(article.content)
        except Exception as e:
            print(f"[!] Summarization failed for {url}: {e}")
        return article


async def main():
    p = argparse.ArgumentParser(description="Crawl & summarize articles")
    p.add_argument("homepage_url", help="Start URL to crawl")
    p.add_argument(
        "--max-links", type=int, default=20, help="Max number of links to fetch"
    )
    p.add_argument("--depth", type=int, default=1, help="Max crawl depth")
    p.add_argument(
        "--concurrency", type=int, default=5, help="Parallel fetch slots"
    )
    p.add_argument(
        "--output", default="articles.json", help="Output JSON filepath"
    )
    args = p.parse_args()

    print(f"Crawling up to {args.max_links} links from {args.homepage_url} (depth={args.depth})...")
    urls = await crawl_homepage(args.homepage_url, args.max_links, args.depth)
    print(f"[+] Found {len(urls)} URLs")

    connector = aiohttp.TCPConnector(limit_per_host=args.concurrency)
    async with aiohttp.ClientSession(
        connector=connector, headers={"User-Agent": ""}
    ) as session:
        sem = asyncio.Semaphore(args.concurrency)
        tasks = [fetch_and_summarize(session, url, sem) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    articles = []
    for res in results:
        if isinstance(res, ArticleData):
            articles.append(res.__dict__)
        else:
            print(f"[!] Error fetching/article: {res}")

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)

    print(f"[✓] Written {len(articles)} articles to {args.output}")


if __name__ == "__main__":
    asyncio.run(main())
