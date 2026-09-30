#!/usr/bin/env bash
#
# Dump the deployed environment's database (ADR 0024 §7).
#
#   scripts/env/snapshot.sh [name]        named snapshot, never deleted automatically
#   scripts/env/snapshot.sh --nightly     nightly snapshot; only the last 7 are kept
#   scripts/env/snapshot.sh --pre-deploy  taken by deploy.sh; only the last 5 are kept
#   scripts/env/snapshot.sh --list        list the snapshots, newest first
#
# Dumps land in $BRIO_SNAPSHOT_DIR (/var/backups/brio) as <name>-<YYYYMMDD-HHMMSS>.dump
# (pg_dump custom format). They live on the server: a convenience before a risky test,
# not a disaster-recovery copy — that is OVH's automated backup.

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

NIGHTLY_KEEP=7
PRE_DEPLOY_KEEP=5

list_snapshots() {
  ls -lht "$BRIO_SNAPSHOT_DIR"/*.dump 2>/dev/null || echo "(no snapshot in $BRIO_SNAPSHOT_DIR)"
}

name=manual
case "${1:-}" in
  --list)
    list_snapshots
    exit 0
    ;;
  --nightly) name=nightly ;;
  --pre-deploy) name=pre-deploy ;;
  "") ;;
  *) name=$1 ;;
esac

printf '%s' "$name" | grep -Eq '^[a-z0-9][a-z0-9-]*$' \
  || die "Snapshot name must be lowercase letters, digits and hyphens, got: '$name'"

[ -d "$BRIO_SNAPSHOT_DIR" ] || die "$BRIO_SNAPSHOT_DIR does not exist (bootstrap.sh creates it)."

file="$BRIO_SNAPSHOT_DIR/$name-$(date +%Y%m%d-%H%M%S).dump"
partial="$file.partial"

info "Dumping the database to $file"
# Write under a temporary name: a failed dump never looks like a usable snapshot.
# shellcheck disable=SC2016 # expanded by the container's shell
if ! pg_exec 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' >"$partial"; then
  rm -f "$partial"
  die "pg_dump failed — no snapshot written."
fi
mv "$partial" "$file"
echo "✓ Snapshot $(basename "$file") ($(du -h "$file" | cut -f1))."

case "$name" in
  nightly) keep=$NIGHTLY_KEEP ;;
  pre-deploy) keep=$PRE_DEPLOY_KEEP ;;
  *) keep=0 ;;
esac

if [ "$keep" -gt 0 ]; then
  # Match the timestamp exactly, so a named snapshot such as pre-deploy-essai-… is
  # left alone. Timestamps sort lexically: the oldest come last in reverse order.
  find "$BRIO_SNAPSHOT_DIR" -maxdepth 1 -name "$name-????????-??????.dump" -type f | sort -r \
    | tail -n +$((keep + 1)) | while read -r old; do
      rm -f "$old"
      echo "  pruned $(basename "$old")"
    done
fi
