from dataclasses import dataclass


@dataclass
class ArticleData:
    url: str
    title: str
    content: str
    source: str
    summary: str = ""
    fetched_at: str = ""
