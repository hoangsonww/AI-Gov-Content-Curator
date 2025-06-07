import os
import time
from typing import List, Dict
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

API_KEY = os.getenv("GOOGLE_AI_API_KEY")
if not API_KEY:
    raise RuntimeError("Missing GOOGLE_AI_API_KEY in env")
genai.configure(api_key=API_KEY)

SYSTEM_INSTRUCTION = os.getenv("AI_INSTRUCTIONS", "")

MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds


def summarize_content(content: str) -> str:
    """
    Summarize the given text using Google Generative AI.
    Retries on rate-limit up to MAX_RETRIES.
    """
    messages: List[Dict[str, str]] = []
    if SYSTEM_INSTRUCTION:
        messages.append({"author": "system", "content": SYSTEM_INSTRUCTION})
    messages.append({"author": "user", "content": f"Summarize the following article:\n\n{content}"})

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = genai.chat.completions.create(
                model="models/chat-bison-001",
                messages=messages,
                temperature=1.0,
                top_p=0.95,
                top_k=64,
                max_output_tokens=8192,
            )
            # response.choices[0].message.content or response.candidates[0].content
            return response.choices[0].message.content.strip()
        except Exception as e:
            if "429" in str(e) and attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
            else:
                raise

