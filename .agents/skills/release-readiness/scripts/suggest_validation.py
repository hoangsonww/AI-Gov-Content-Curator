#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]


def current_paths() -> list[str]:
    try:
        output = subprocess.check_output(
            ["git", "status", "--short"],
            cwd=ROOT,
            text=True,
        )
    except Exception:
        return []

    paths: list[str] = []
    for line in output.splitlines():
        if not line.strip():
            continue
        path = line[3:].strip()
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        paths.append(path)
    return paths


def add(mapping: dict[str, list[str]], key: str, value: str) -> None:
    mapping.setdefault(key, [])
    if value not in mapping[key]:
        mapping[key].append(value)


def main(argv: list[str]) -> int:
    paths = argv or current_paths()
    if not paths:
        print("No paths provided and no modified files detected.")
        return 0

    suggestions: dict[str, list[str]] = {}
    notes: list[str] = []

    for raw_path in paths:
        path = raw_path.lstrip("./")

        if path.startswith("backend/"):
            add(suggestions, "backend", "cd backend && npm test")
            if "auth" in path or "chat" in path:
                notes.append(f"{path}: security or streaming behavior may need extra review.")
        elif path.startswith("frontend/"):
            add(suggestions, "frontend", "cd frontend && npm run lint")
            if "/pages/" in path or "/components/" in path or path.endswith("playwright.config.ts"):
                add(suggestions, "frontend", "cd frontend && npm run test:e2e")
        elif path.startswith("crawler/"):
            add(suggestions, "crawler", "cd crawler && npm test")
            if "/schedule/" in path or "/scripts/" in path or path.endswith("vercel.json"):
                notes.append(f"{path}: crawler changes can trigger live fetches, cleanup, or schedule drift.")
        elif path.startswith("newsletters/"):
            add(suggestions, "newsletters", "cd newsletters && npm test")
            if "/schedule/" in path or path.endswith("vercel.json") or "Dockerfile" in path:
                notes.append(f"{path}: newsletter changes can affect live sends or deployment assumptions.")
        elif path.startswith("agentic_ai/"):
            add(suggestions, "agentic_ai", "Review Python dependency and runtime consistency before running agentic_ai commands.")
        elif path.startswith("infrastructure/"):
            add(suggestions, "infrastructure", "Review Terraform/Kubernetes/script consistency before running apply or deploy commands.")
        elif path.startswith(".agents/") or path.startswith("codex/rules/") or path.endswith("AGENTS.md"):
            add(suggestions, "codex-support", "Validate that the new guidance matches current scripts, routes, and repo structure.")

    print("Suggested validation:")
    for area in sorted(suggestions):
        print(f"- {area}:")
        for command in suggestions[area]:
            print(f"  {command}")

    if notes:
        print("\nAdditional notes:")
        for note in notes:
            print(f"- {note}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
