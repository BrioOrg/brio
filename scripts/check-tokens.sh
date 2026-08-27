#!/usr/bin/env bash
# Anti-drift gate: fails if any file under web/app or web/components uses
# design values outside of tokens.css — arbitrary Tailwind values, raw hex/rgb
# colours, inline font-family declarations, or gradient utilities.
#
# Run: bash scripts/check-tokens.sh
# CI : see .github/workflows/ci.yml (web job)

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
WEB="$ROOT/web"

DIRS=("$WEB/app" "$WEB/components")
EXTS=("*.tsx" "*.ts" "*.css")

TOKENS_CSS="$WEB/app/tokens.css"

failures=0

check() {
  local description="$1"
  local pattern="$2"
  # Build find args for all dirs + extensions
  local find_args=()
  for dir in "${DIRS[@]}"; do
    find_args+=("$dir")
  done
  find_args+=("(")
  local first=1
  for ext in "${EXTS[@]}"; do
    if [[ $first -eq 0 ]]; then find_args+=("-o"); fi
    find_args+=("-name" "$ext")
    first=0
  done
  find_args+=(")")

  local matches
  matches=$(find "${find_args[@]}" -print0 \
    | xargs -0 grep -lE "$pattern" 2>/dev/null \
    | grep -v "$TOKENS_CSS" \
    | grep -v '\.next' || true)

  if [[ -n "$matches" ]]; then
    echo "✗ $description"
    while IFS= read -r file; do
      local hits
      hits=$(grep -nE "$pattern" "$file" | head -5)
      echo "  $file"
      while IFS= read -r hit; do
        echo "    $hit"
      done <<< "$hits"
    done <<< "$matches"
    echo ""
    failures=$((failures + 1))
  else
    echo "✓ $description"
  fi
}

echo "=== brio token-drift check ==="
echo ""

# Arbitrary Tailwind colour values: text-[#...] bg-[#...] border-[#...] etc.
check \
  "No arbitrary hex colour values in Tailwind classes" \
  "(text|bg|border|ring|fill|stroke|shadow|outline|accent|caret|decoration)-\[#[0-9a-fA-F]"

# Arbitrary Tailwind rgb/hsl values
check \
  "No arbitrary rgb/hsl colour values in Tailwind classes" \
  "(text|bg|border|ring|fill|stroke|shadow)-\[(rgb|hsl|oklch|color)"

# Raw hex in CSS (but not inside tokens.css)
check \
  "No raw hex colours in CSS outside tokens.css" \
  ":\s*#[0-9a-fA-F]{3,8}([^a-fA-F0-9]|$)"

# Raw rgb/hsl in CSS
check \
  "No raw rgb/hsl colours in CSS outside tokens.css" \
  ":\s*(rgb|hsl|oklch)\("

# Arbitrary px sizes in Tailwind (e.g. w-[13px], h-[22px], p-[7px])
check \
  "No arbitrary px sizes in Tailwind classes" \
  "(w|h|min-w|max-w|min-h|max-h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-\[[0-9]+(px|rem)"

# Inline font-family outside tokens.css
check \
  "No font-family declarations outside tokens.css" \
  "font-family\s*:"

# Gradient utilities (bg-gradient-*) — banned to prevent complexity drift
check \
  "No bg-gradient-* Tailwind utilities" \
  "bg-gradient-"

echo "================================"
if [[ $failures -gt 0 ]]; then
  echo "✗ $failures check(s) failed. Fix violations in web/app/tokens.css or remove them."
  exit 1
else
  echo "✓ All checks passed."
fi
