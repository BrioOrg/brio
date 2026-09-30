#!/usr/bin/env bash
#
# Replace the deployed environment's database with a snapshot (ADR 0024 §7).
#
#   scripts/env/restore.sh <snapshot> [--yes]
#
# <snapshot> is a path, or a file name in $BRIO_SNAPSHOT_DIR (see snapshot.sh --list).
# The current database is snapshotted first (pre-restore-…), so a restore can itself
# be undone. Refuses unless deploy/.env sets BRIO_RESET_ALLOWED=true.

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

snapshot=""
assume_yes=false
for arg in "$@"; do
  case "$arg" in
    --yes) assume_yes=true ;;
    *) snapshot=$arg ;;
  esac
done

[ -n "$snapshot" ] || die "Usage: scripts/env/restore.sh <snapshot> [--yes]  (list them: scripts/env/snapshot.sh --list)"
if [ ! -f "$snapshot" ] && [ -f "$BRIO_SNAPSHOT_DIR/$snapshot" ]; then
  snapshot="$BRIO_SNAPSHOT_DIR/$snapshot"
fi
[ -f "$snapshot" ] || die "No such snapshot: $snapshot"

require_reset_allowed
confirm_destruction "replace the database with $(basename "$snapshot")" "$assume_yes"
acquire_lock 0

"$BRIO_ROOT/scripts/env/snapshot.sh" pre-restore

info "Stopping backend and web"
compose stop backend web

recreate_database

info "Restoring $(basename "$snapshot")"
# --no-owner: objects belong to whoever restores, i.e. this environment's user, even
# if the dump came from a database with another owner.
# shellcheck disable=SC2016 # expanded by the container's shell
pg_exec 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' <"$snapshot"

info "Starting backend and web"
compose up -d backend web
wait_for_backend

echo "✓ Restored $(basename "$snapshot") on $BRIO_DOMAIN."
