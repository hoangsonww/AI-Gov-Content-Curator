import re
from typing import Iterable, List
from urllib.parse import urlparse, urlsplit, urlunsplit, urldefrag

from .config import SKIP_EXTENSIONS


def compile_patterns(patterns: Iterable[str]) -> List[re.Pattern]:
    return [re.compile(p, re.IGNORECASE) for p in patterns]


def normalize_url(raw_url: str) -> str:
    raw_url = raw_url.strip()
    if not raw_url:
        return ""

    raw_url, _ = urldefrag(raw_url)
    parts = urlsplit(raw_url)
    if parts.scheme and parts.scheme.lower() not in ("http", "https"):
        return ""

    scheme = parts.scheme.lower() if parts.scheme else "http"
    netloc = parts.netloc.lower()
    if netloc.endswith(":80") and scheme == "http":
        netloc = netloc[:-3]
    if netloc.endswith(":443") and scheme == "https":
        netloc = netloc[:-4]

    path = re.sub(r"/+", "/", parts.path or "/")
    return urlunsplit((scheme, netloc, path, parts.query, ""))


def should_skip_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return True
    path = parsed.path.lower()
    return any(path.endswith(ext) for ext in SKIP_EXTENSIONS)


def matches_patterns(url: str, includes: List[re.Pattern], excludes: List[re.Pattern]) -> bool:
    if excludes and any(p.search(url) for p in excludes):
        return False
    if not includes:
        return True
    return any(p.search(url) for p in includes)
