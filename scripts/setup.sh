#!/usr/bin/env bash
#
# One-time local setup: point git at the repo's shared hooks.
# Run once after cloning:  scripts/setup.sh
set -eu

# Resolve repo root so this works from any directory.
root=$(git rev-parse --show-toplevel)
cd "$root"

git config core.hooksPath .githooks

# Ensure the hooks are executable (git respects the file mode).
chmod +x .githooks/* 2>/dev/null || true

echo "✓ Git hooks enabled (core.hooksPath = .githooks)."
echo "  commit-msg: enforces Conventional Commits + issue reference."
echo "  pre-push:   blocks direct pushes to main / develop."
