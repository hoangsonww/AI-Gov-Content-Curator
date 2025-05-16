# The AICC CLI

A comprehensive command‐line interface (CLI) for managing and running the **AI Article Content Curator (AICC)** monorepo from the root directory. You can:

- Start, build, and run each workspace (frontend, backend, crawler)
- Lint and format code across all packages
- Perform CRUD operations against your backend API’s `/articles` endpoint
- And more!

---

## 📋 Prerequisites

- **Node.js** v18.x (as specified in `package.json`)
- **npm** (comes with Node.js)
- A running **MongoDB** instance or proper `MONGODB_URI` env var for your backend
- Your backend API server (default `http://localhost:3000/api`) must be reachable

---

## ⚙️ Installation

1. **Install dependencies** at the repo root:

   ```bash
   npm install
   ```

2. **Link the CLI** so you can run `aicc` anywhere in this repo:

   ```bash
   npm link
   ```

   > This creates a global symlink named `aicc` pointing at `bin/aicc.js`.

---

## 🛠️ Configuration

| Env Var        | Default                     | Description                                  |
| -------------- | --------------------------- | -------------------------------------------- |
| `AICC_API_URL` | `http://localhost:3000/api` | Base URL for article‐CRUD HTTP requests.     |
| `NODE_ENV`     | (unspecified)               | Controls whether backend starts HTTP server. |

Set these in a `.env` file at the root or export them in your shell:

```bash
export AICC_API_URL="https://api.mycurator.com/api"
export NODE_ENV="development"
```

---

## 🚀 Usage

Run `aicc` with no arguments to see the help:

```bash
aicc
```

### Service Management

```bash
# Start all workspaces in parallel (dev mode)
aicc dev

# Start just the frontend in dev mode
aicc dev frontend

# Build backend for production
aicc build backend

# Start crawler in production mode
aicc start crawler

# Lint all code
aicc lint

# Alias for lint
aicc format
```

Valid `<service>` values: `frontend`, `backend`, `crawler`.

---

## 📝 Article CRUD Commands

All CRUD commands call your backend’s `/api/articles` endpoints using `axios`.

```bash
# Create a new article
aicc article create \
  --title "My AI Insights" \
  --content "Full article content goes here..." \
  --summary "A brief summary" \
  --topics ai machine-learning \
  --source "CLI"

# Fetch one article by ID
aicc article get 64a1f2d3e4b5c6a7d8e9f0

# List all articles (optionally limit results)
aicc article list --limit 10

# Update fields on an existing article
aicc article update 64a1f2d3e4b5c6a7d8e9f0 \
  --title "Updated Title" \
  --topics ai research

# Delete an article by ID
aicc article delete 64a1f2d3e4b5c6a7d8e9f0
```

### Command Reference

| Command                              | Description                                            |
| ------------------------------------ | ------------------------------------------------------ |
| `aicc article create [--flags]`      | Create a new article (requires `--title`, `--content`) |
| `aicc article get <id>`              | Fetch an article by its MongoDB `_id`                  |
| `aicc article list [--limit N]`      | List all articles, optionally limited                  |
| `aicc article update <id> [--flags]` | Update one or more fields on an existing article       |
| `aicc article delete <id>`           | Delete an article by its `_id`                         |

#### Flags for `create` and `update`

- `--title <string>` — Article title
- `--content <string>` — Article content (stored in `content` field)
- `--summary <string>` — Article summary (optional)
- `--topics <list...>` — List of topic strings (optional)
- `--source <string>` — Source identifier (optional)

---

## 🛠️ Development & Contributing

1. Fork the repo & clone locally
2. `npm install` at root
3. `npm link` to register the `aicc` command
4. Make your changes in `bin/aicc.js`
5. Add tests or update documentation here
6. Submit a PR!

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
