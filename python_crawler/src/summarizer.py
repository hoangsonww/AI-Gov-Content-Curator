import os
import re
import time
from typing import List, Optional

from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GOOGLE_AI_API_KEY")
MODEL_NAME = os.getenv("GOOGLE_AI_MODEL", "models/gemini-1.5-flash")
SYSTEM_INSTRUCTION = os.getenv("AI_INSTRUCTIONS", "")

MAX_RETRIES = int(os.getenv("AI_MAX_RETRIES", "3"))
RETRY_DELAY = float(os.getenv("AI_RETRY_DELAY", "2"))
MAX_INPUT_CHARS = int(os.getenv("AI_MAX_INPUT_CHARS", "12000"))

try:
    import google.generativeai as genai

    genai.configure(api_key=API_KEY)
except Exception:  # pragma: no cover - optional dependency
    genai = None


def _chunk_text(text: str, max_chars: int) -> List[str]:
    if len(text) <= max_chars:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        chunks.append(text[start:end])
        start = end
    return chunks


def _extractive_summary(text: str, max_sentences: int = 6) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return " ".join(sentences[:max_sentences]).strip()


def _summarize_with_genai(prompt: str) -> str:
    if genai is None:
        raise RuntimeError("Google Generative AI SDK is unavailable")

    if hasattr(genai, "GenerativeModel"):
        model = genai.GenerativeModel(MODEL_NAME)
        response = model.generate_content(prompt)
        return (response.text or "").strip()

    if hasattr(genai, "chat"):
        messages = []
        if SYSTEM_INSTRUCTION:
            messages.append({"author": "system", "content": SYSTEM_INSTRUCTION})
        messages.append({"author": "user", "content": prompt})
        response = genai.chat.completions.create(
            model="models/chat-bison-001",
            messages=messages,
            temperature=0.7,
            top_p=0.95,
            top_k=64,
            max_output_tokens=2048,
        )
        return response.choices[0].message.content.strip()

    raise RuntimeError("Unsupported Google Generative AI SDK version")


def summarize_content(content: str) -> str:
    if not content:
        return ""

    trimmed = content.strip()
    if not API_KEY or genai is None:
        return _extractive_summary(trimmed)

    chunks = _chunk_text(trimmed, MAX_INPUT_CHARS)
    summaries: List[str] = []

    for chunk in chunks:
        instruction = f"{SYSTEM_INSTRUCTION}\n\n" if SYSTEM_INSTRUCTION else ""
        prompt = f"{instruction}Summarize the following article for a professional audience:\n\n{chunk}"
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                summary = _summarize_with_genai(prompt)
                if summary:
                    summaries.append(summary)
                    break
            except Exception as exc:
                if attempt >= MAX_RETRIES:
                    summaries.append(_extractive_summary(chunk))
                    break
                time.sleep(RETRY_DELAY)
                continue

    if len(summaries) == 1:
        return summaries[0]

    combined = "\n".join(summaries)
    try:
        return _summarize_with_genai(
            f"Combine the following summaries into a concise final summary:\n\n{combined}"
        )
    except Exception:
        return _extractive_summary(combined)
