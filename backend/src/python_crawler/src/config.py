from dataclasses import dataclass, field
from typing import List

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

SKIP_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".pdf",
    ".zip",
    ".rar",
    ".7z",
    ".css",
    ".js",
    ".json",
    ".xml",
    ".mp4",
    ".mp3",
    ".wav",
    ".avi",
    ".mov",
}


@dataclass
class CrawlerConfig:
    max_links: int = 20
    max_depth: int = 1
    concurrency: int = 5
    request_timeout: int = 12
    request_delay: float = 0.0
    max_retries: int = 3
    backoff_base: float = 0.8
    user_agent: str = DEFAULT_USER_AGENT
    allow_subdomains: bool = True
    respect_robots: bool = True
    js_fallback: bool = True
    min_text_length: int = 600
    allowed_domains: List[str] = field(default_factory=list)
    include_patterns: List[str] = field(default_factory=list)
    exclude_patterns: List[str] = field(default_factory=list)
