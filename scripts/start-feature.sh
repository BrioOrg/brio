#!/usr/bin/env bash
#
# Start a new feature branch off an up-to-date develop.
#
#   scripts/start-feature.sh <issue-number> <description...>
#
# Example:
#   scripts/start-feature.sh 42 "Curriculum import endpoint"
#   -> checks out develop, pulls --rebase, creates feature/42-curriculum-import-endpoint
#
# Use fix/ or chore/ prefixes by passing --type:
#   scripts/start-feature.sh --type fix 42 "Broken login redirect"
set -eu

type="feature"
if [ "${1:-}" = "--type" ]; then
  type="${2:-}"
  shift 2 || true
fi

issue="${1:-}"
shift || true
description="$*"

usage() {
  echo "Usage: scripts/start-feature.sh [--type feature|fix|chore] <issue-number> <description>" >&2
  echo "Example: scripts/start-feature.sh 42 \"Curriculum import endpoint\"" >&2
}

case "$type" in
  feature|fix|chore) ;;
  *) echo "✗ --type must be one of: feature, fix, chore" >&2; usage; exit 1 ;;
esac

if ! printf '%s' "$issue" | grep -Eq '^[0-9]+$'; then
  echo "✗ Issue number must be numeric, got: '${issue}'" >&2
  usage
  exit 1
fi

if [ -z "$description" ]; then
  echo "✗ A description is required." >&2
  usage
  exit 1
fi

# Refuse to run on a dirty tree — never carry uncommitted work onto a new branch.
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ Working tree is dirty. Commit or stash your changes first." >&2
  git status --short >&2
  exit 1
fi

# Slugify: lowercase, non-alphanumerics -> hyphens, squeeze/trim hyphens, truncate.
slug=$(printf '%s' "$description" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -e 's/[^a-z0-9]\{1,\}/-/g' -e 's/^-*//' -e 's/-*$//' \
  | cut -c1-50 \
  | sed 's/-*$//')

if [ -z "$slug" ]; then
  echo "✗ Description produced an empty slug: '${description}'" >&2
  exit 1
fi

branch="${type}/${issue}-${slug}"

echo "→ Updating develop…"
git checkout develop
git pull --rebase

echo "→ Creating ${branch}"
git checkout -b "$branch"

echo "✓ On ${branch} — start committing."
