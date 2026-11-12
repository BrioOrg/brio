#!/usr/bin/env bash
# Changed production classes → PIT patterns (mesh Phase 3, #358).
#
#   scripts/mesh/verification/changed-java-classes.sh origin/develop
#
# Prints, one per line, the fully-qualified class names of the main Java files changed since
# <base> (default origin/develop). Empty output = nothing to mutate. Used by mesh-mutation.yml:
#   ./mvnw -Pmutation … -Dpit.targetClasses="$(… | paste -sd, -)"
# so mutation runs on the changed classes only (a full run is far too slow for a PR).
set -euo pipefail

BASE="${1:-origin/develop}"
ROOT="$(git rev-parse --show-toplevel)"

git -C "$ROOT" diff --name-only --diff-filter=AM "$BASE"...HEAD -- 'backend/src/main/java/**/*.java' \
  | sed -e 's#^backend/src/main/java/##' -e 's#\.java$##' -e 's#/#.#g' \
  | grep -v -E '(^|\.)(package-info|BrioBackendApplication)$' || true
