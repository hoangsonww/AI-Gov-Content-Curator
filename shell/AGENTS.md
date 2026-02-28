# Shell Guidance

- Treat `shell/` scripts as convenience wrappers with some path drift.
- Verify relative paths before trusting a shell script.
- Prefer root/workspace scripts or `bin/aicc.js` when a shell wrapper looks stale or ambiguous.
- Be careful with scripts that trigger crawler or newsletter jobs.
