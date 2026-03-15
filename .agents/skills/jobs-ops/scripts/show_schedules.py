#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]

SERVICES = {
    "crawler": ROOT / "crawler" / "vercel.json",
    "newsletters": ROOT / "newsletters" / "vercel.json",
}


def route_path_to_file(service: str, route_path: str) -> Path:
    relative = route_path.removeprefix("/").split("/")
    return ROOT / service / "pages" / Path(*relative).with_suffix(".ts")


def main() -> int:
    for service, config_path in SERVICES.items():
        print(f"{service}:")
        if not config_path.exists():
            print(f"  missing config: {config_path}")
            continue

        config = json.loads(config_path.read_text())
        crons = config.get("crons", [])
        if not crons:
            print("  no cron entries")
            continue

        for entry in crons:
            route = entry.get("path", "")
            schedule = entry.get("schedule", "")
            route_file = route_path_to_file(service, route)
            exists = "exists" if route_file.exists() else "missing"
            print(f"  {schedule}  {route}  ->  {route_file.relative_to(ROOT)} ({exists})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
