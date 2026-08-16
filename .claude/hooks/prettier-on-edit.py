#!/usr/bin/env python3
"""PostToolUse hook: runs Prettier on edited files under /web and /packages."""
import json
import re
import subprocess
import sys

PATTERN = re.compile(r"/(web|packages)/.*\.(ts|tsx|js|jsx|json|css)$")

try:
    data = json.load(sys.stdin)
    tool_input = data.get("tool_input") or data.get("input") or {}
    file_path = tool_input.get("file_path", "")

    if file_path and PATTERN.search(file_path):
        subprocess.run(
            ["npx", "prettier", "--write", file_path],
            capture_output=True,
            timeout=30,
        )
except Exception:
    pass
