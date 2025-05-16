# Python Version of the Crawler & Summarizer

A high-performance, concurrent crawler that:

- **Discovers** article URLs via BFS crawling
- **Fetches** pages statically (via HTTP/BeautifulSoup) or dynamically (via Playwright)
- **Summarizes** content using Google Generative AI
- **Runs** as an easy-to-use CLI (`run_crawler.py`)

---

## 📋 Prerequisites

- **Python 3.8+**
- **Git** (to clone repo)
- **Node.js** (for Playwright browser binaries)
- A **Google AI API key** with access to the Generative AI models
- (Optional) a `.env` file in the project root

---

## 🔧 Installation

1. **Clone** the repo:

   ```bash
   git clone https://github.com/your-org/ai-article-content-curator.git
   cd ai-article-content-curator
   ```

2. **Create & activate** a virtual environment:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install** Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. **Install** Playwright browsers:

   ```bash
   playwright install
   ```

---

## ⚙️ Configuration

Create a `.env` file at the project root with:

```dotenv
GOOGLE_AI_API_KEY=your-google-generative-ai-key
AI_INSTRUCTIONS=“(Optional) any system‐level instructions for summarization”
```

- `GOOGLE_AI_API_KEY` **(required)**: your API key for Google Generative AI.
- `AI_INSTRUCTIONS` **(optional)**: prepend custom system instructions for every summarization.

---

## 🚀 Usage

```bash
python run_crawler.py <homepage_url> [options]
```

### Example

```bash
python run_crawler.py https://example.com \
  --max-links 50 \
  --depth 2 \
  --concurrency 8 \
  --output articles.json
```

| Option          | Default         | Description                                |
| --------------- | --------------- | ------------------------------------------ |
| `homepage_url`  | _required_      | Start URL to begin crawling                |
| `--max-links`   | `20`            | Maximum number of distinct links to fetch  |
| `--depth`       | `1`             | BFS crawl depth (levels of link following) |
| `--concurrency` | `5`             | Number of parallel fetch/summarize tasks   |
| `--output`      | `articles.json` | Path to write the resulting JSON array     |

After completion, the output file contains an array of objects:

```jsonc
[
  {
    "url": "...",
    "title": "...",
    "content": "...",  // summarized text
    "source": "..."
  },
  …
]
```

---

## 🗂️ Module Breakdown

### `crawler.py`

- **`crawl_homepage`**: BFS discovery of same-host `<a>` links
- **`fetch_static`**: `aiohttp` + `BeautifulSoup` HTML fetch with retry
- **`fetch_dynamic`**: Playwright JS-rendered fallback

### `summarizer.py`

- **`summarize_content`**: Google Generative AI chat completion
- Respects rate-limit retries; configurable system prompt

### `run_crawler.py`

- CLI entrypoint
- Parses arguments, performs crawl → fetch → summarize pipeline
- Writes output JSON

---

## 🛠️ Development & Testing

- **Lint**: _(if you add linters)_
- **Unit tests**: you can write `pytest` tests targeting each module.
- **Playwright debugging**: use `DEBUG=pw:api` environment var.

---

## 🤝 Contributing

1. Fork & clone
2. Create a feature branch
3. Commit changes & push
4. Open a PR

Please add/update tests for new behaviors.

---

## 📄 License

This project is licensed under the MIT License.
