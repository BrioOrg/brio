#!/usr/bin/env bash
#
# Deploy the latest develop on the private environment (ADR 0024): pull, rebuild the
# images on the server, restart what changed.
#
#   scripts/env/deploy.sh
#
# Catalogue ingestion stays a separate, explicit step (see docs/deploy/README.md).

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

# The private environment follows develop (main is production). Overridable only to
# try this script from another branch.
branch=${BRIO_DEPLOY_BRANCH:-develop}

cd "$BRIO_ROOT" || exit

# Never build something that is not in the repository.
[ -z "$(git status --porcelain)" ] || die "The clone has local changes — deploy only what is committed:
$(git status --short)"

info "Updating $branch"
git fetch --quiet origin "$branch"
git checkout --quiet "$branch"
git merge --quiet --ff-only "origin/$branch"
echo "  at $(git log -1 --format='%h %s')"

# One image at a time: on a 4 GB VPS (ADR 0024 §1), the Maven and Next.js builds in
# parallel, next to the running stack, would push it deep into swap or get a
# container killed. The stack keeps serving the previous images meanwhile.
info "Building the backend image"
compose build backend
info "Building the web image"
compose build web

info "Restarting services"
compose up -d --remove-orphans
wait_for_backend

# Images are built here, so every deploy leaves the previous layers behind. Keep a
# week of them (fast rebuilds, room to roll back) and drop the rest before the disk
# fills.
info "Pruning images and build cache older than 7 days"
docker image prune --force --filter until=168h >/dev/null
docker builder prune --force --filter until=168h >/dev/null

echo "✓ Deployed $(git log -1 --format='%h') on https://$BRIO_DOMAIN."
