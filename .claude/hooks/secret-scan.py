#!/usr/bin/env python3
"""PreToolUse hook: blocks secrets and forbidden file mutations."""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

HOOK_DIR = Path(__file__).resolve().parent
CONFIG_FILE = HOOK_DIR / "secret-patterns.json"

# Staged diffs larger than this are too slow to scan; skip and warn instead.
STAGED_DIFF_LINE_LIMIT = 10_000

# Versioned Flyway migrations only — repeatable (R__*.sql) are intentionally editable.
VERSIONED_MIGRATION = re.compile(r"^V\d+(?:[._]\d+)*__[^/\\]+\.sql$", re.IGNORECASE)


# ── config ────────────────────────────────────────────────────────────────────


def load_config() -> dict:
    try:
        return json.loads(CONFIG_FILE.read_text())
    except Exception as exc:
        _warn(f"secret-scan: cannot read config ({exc}); skipping pattern checks")
        return {"patterns": [], "env_allowlist": []}


def compile_patterns(config: dict) -> list[tuple[re.Pattern, str]]:
    compiled = []
    for entry in config.get("patterns", []):
        flags = 0
        for f in entry.get("flags", []):
            flags |= getattr(re, f.upper(), 0)
        try:
            compiled.append((re.compile(entry["regex"], flags), entry["name"]))
        except re.error as exc:
            _warn(f"secret-scan: bad pattern '{entry.get('name', '?')}': {exc}")
    return compiled


# ── helpers ───────────────────────────────────────────────────────────────────


def _warn(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def scan_text(text: str, patterns: list[tuple[re.Pattern, str]]) -> list[str]:
    return [name for pat, name in patterns if pat.search(text)]


def is_blocked_env_file(path: str, allowlist: list[str]) -> bool:
    """Block .env and any .env.* file not in the exact-name allowlist."""
    name = os.path.basename(path)
    if name in allowlist:
        return False
    return name == ".env" or name.startswith(".env.")


def is_applied_versioned_migration(path: str) -> bool:
    """True if path matches V*__*.sql and has at least one commit in git history."""
    name = os.path.basename(path)
    if not VERSIONED_MIGRATION.match(name):
        return False
    try:
        result = subprocess.run(
            ["git", "log", "--oneline", "--", path],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return bool(result.stdout.strip())
    except Exception:
        return False


def scan_staged_diff(patterns: list[tuple[re.Pattern, str]]) -> list[str] | None:
    """
    Scan addition lines in the staged diff for secret patterns.
    Returns None if the diff is too large to scan (caller should warn).
    Gap in coverage: secrets arriving via shell environment variables already set
    outside this session (e.g. `echo $ALREADY_SET_SECRET`) are not visible here.
    """
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--unified=0"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        lines = result.stdout.splitlines()
        if len(lines) > STAGED_DIFF_LINE_LIMIT:
            return None
        additions = "\n".join(
            line[1:] for line in lines
            if line.startswith("+") and not line.startswith("+++")
        )
        return scan_text(additions, patterns)
    except Exception:
        return []


# ── main ──────────────────────────────────────────────────────────────────────


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool_name: str = data.get("tool_name", "")
    tool_input: dict = data.get("tool_input") or {}

    config = load_config()
    patterns = compile_patterns(config)
    allowlist: list[str] = config.get("env_allowlist", [])
    reasons: list[str] = []

    if tool_name in ("Write", "Edit"):
        path = tool_input.get("file_path", "")

        if path and is_blocked_env_file(path, allowlist):
            name = os.path.basename(path)
            reasons.append(
                f"write to '{name}' — .env files must not be committed; "
                f"use .env.example (or .env.sample / .env.template) for templates"
            )

        if path and is_applied_versioned_migration(path):
            name = os.path.basename(path)
            reasons.append(
                f"edit to applied Flyway migration '{name}' — Flyway records a checksum "
                f"for each applied migration; modifying it breaks validation on every "
                f"environment where it has already run. Create a new migration instead."
            )

        content_key = "content" if tool_name == "Write" else "new_string"
        for name in scan_text(tool_input.get(content_key, ""), patterns):
            reasons.append(f"credential pattern detected: {name}")

    elif tool_name == "Bash":
        command = tool_input.get("command", "")

        for name in scan_text(command, patterns):
            reasons.append(f"credential pattern detected in command: {name}")

        if re.search(r"\bgit\s+commit\b", command):
            matches = scan_staged_diff(patterns)
            if matches is None:
                _warn(
                    "secret-scan: staged diff exceeds line limit; "
                    "skipped pattern scan of staged changes"
                )
            else:
                for name in matches:
                    reasons.append(f"credential pattern detected in staged diff: {name}")

    if reasons:
        print("", flush=True)
        print("╔══ SECRET SCAN BLOCKED ══════════════════════════════════════╗", flush=True)
        for r in reasons:
            print(f"  ✗ {r}", flush=True)
        print("╚═════════════════════════════════════════════════════════════╝", flush=True)
        print("", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
