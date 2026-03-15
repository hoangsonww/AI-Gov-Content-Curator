#!/usr/bin/env bash
set -euo pipefail

python3 -c '
import json
import os
import sys

payload = json.load(sys.stdin)
tool_input = payload.get("tool_input", {}) or {}

paths = []
for key in ("file_path", "path"):
    value = tool_input.get(key)
    if isinstance(value, str):
        paths.append(value)

for item in tool_input.get("edits", []) or []:
    if isinstance(item, dict):
        value = item.get("file_path") or item.get("path")
        if isinstance(value, str):
            paths.append(value)

blocked_fragments = [
    "/node_modules/",
    "/.next/",
    "/coverage/",
    "/dist/",
    "/.vercel/",
    "/test-results/",
]

blocked_suffixes = [
    "/.env",
    "/backend/.env",
    "/crawler/.env",
    "/newsletters/.env",
    "/frontend/.env.local",
    "/.DS_Store",
]

def is_blocked(path: str) -> bool:
    norm = path.replace("\\\\", "/")
    if any(fragment in norm for fragment in blocked_fragments):
        return True
    if any(norm.endswith(suffix) for suffix in blocked_suffixes):
        return True
    return False

for path in paths:
    if is_blocked(path):
        print(
            f"Blocked edit to generated or local-only path: {path}. "
            "Edit source files or examples instead.",
            file=sys.stderr,
        )
        sys.exit(2)
'
