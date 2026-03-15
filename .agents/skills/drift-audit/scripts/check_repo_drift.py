#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]


def read(path: Path) -> str:
    return path.read_text() if path.exists() else ""


def main() -> int:
    findings: list[str] = []

    crawler_route = ROOT / "crawler" / "pages" / "api" / "scheduled" / "cleanArticles.ts"
    crawler_missing_script = ROOT / "crawler" / "scripts" / "cleanArticles.ts"
    crawler_actual_script = ROOT / "crawler" / "scripts" / "cleanData.ts"
    if crawler_route.exists():
        text = read(crawler_route)
        if "scripts/cleanArticles.ts" in text and not crawler_missing_script.exists() and crawler_actual_script.exists():
            findings.append(
                "crawler cleanup route calls scripts/cleanArticles.ts, but the existing script is crawler/scripts/cleanData.ts."
            )

    newsletters_docker = ROOT / "newsletters" / "Dockerfile"
    newsletters_dist = ROOT / "newsletters" / "dist" / "schedule" / "sendNewsletter.js"
    if newsletters_docker.exists():
        text = read(newsletters_docker)
        if 'npm", "run", "send"' in text and not newsletters_dist.exists():
            findings.append(
                "newsletters Dockerfile defaults to npm run send, but newsletters/dist/schedule/sendNewsletter.js is not present."
            )

    frontend_api = ROOT / "frontend" / "services" / "api.ts"
    frontend_chat = ROOT / "frontend" / "pages" / "ai_chat.tsx"
    if frontend_api.exists() and frontend_chat.exists():
        api_text = read(frontend_api)
        chat_text = read(frontend_chat)
        if "https://ai-content-curator-backend.vercel.app/api" in api_text and "NEXT_PUBLIC_API_URL" in chat_text:
            findings.append(
                "frontend uses a hard-coded API base in services/api.ts while ai_chat.tsx also uses NEXT_PUBLIC_API_URL."
            )

    agentic_makefile = ROOT / "agentic_ai" / "Makefile"
    if agentic_makefile.exists():
        text = read(agentic_makefile)
        if "tests/" in text and not (ROOT / "agentic_ai" / "tests").exists():
            findings.append("agentic_ai Makefile references tests/, but agentic_ai/tests/ is missing.")
        if "examples/" in text and not (ROOT / "agentic_ai" / "examples").exists():
            findings.append("agentic_ai Makefile references examples/, but agentic_ai/examples/ is missing.")

    shell_readme = ROOT / "shell" / "README.md"
    shell_dir = ROOT / "shell"
    if shell_readme.exists():
        script_hits = []
        for script in shell_dir.glob("*.sh"):
            text = read(script)
            if "cd ../" in text:
                script_hits.append(script.name)
        if script_hits:
            findings.append(
                "shell README says scripts are meant to be run from repo root, but these scripts contain cd ../ path assumptions: "
                + ", ".join(sorted(script_hits))
                + "."
            )

    if findings:
        print("Known drift findings:")
        for finding in findings:
            print(f"- {finding}")
    else:
        print("No known drift findings detected by this script.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
