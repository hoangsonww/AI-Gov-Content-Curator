from typing import Tuple

from bs4 import BeautifulSoup

try:
    from readability import Document
except Exception:  # pragma: no cover
    Document = None


def _clean_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "aside", "form"]):
        tag.decompose()
    return str(soup)


def extract_text_and_title(html: str) -> Tuple[str, str]:
    title = "Untitled"
    cleaned_html = html

    if Document:
        try:
            doc = Document(html)
            title = doc.short_title() or title
            cleaned_html = doc.summary()
        except Exception:
            cleaned_html = html

    soup = BeautifulSoup(_clean_html(cleaned_html), "html.parser")
    if soup.title and soup.title.string:
        title = soup.title.string.strip() or title

    text = soup.get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines), title
