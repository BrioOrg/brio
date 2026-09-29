#!/usr/bin/env bash
#
# Bring the deployed environment back to a blank database (ADR 0024 §7): schema from
# the Flyway migrations, catalogue from ingestion, no account, no e-mail.
#
#   scripts/env/reset.sh [--yes]
#
# The current database is snapshotted first (pre-reset-…). Refuses unless deploy/.env
# sets BRIO_RESET_ALLOWED=true.

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

assume_yes=false
[ "${1:-}" = "--yes" ] && assume_yes=true

require_reset_allowed
confirm_destruction "reset the database to an empty one" "$assume_yes"

"$BRIO_ROOT/scripts/env/snapshot.sh" pre-reset

info "Stopping backend and web"
compose stop backend web

recreate_database

# Ingestion boots the application, so it applies the Flyway migrations to the empty
# database before loading the catalogue. Running it before the backend starts
# keeps two Flyway runs from racing on a fresh schema.
info "Applying migrations and ingesting the catalogue"
compose --profile ingest run --rm ingest

info "Starting backend and web"
compose up -d backend web
wait_for_backend

# Captured e-mails hold consent links to accounts that no longer exist.
info "Emptying Mailpit"
compose stop mailpit
compose run --rm --no-deps --entrypoint sh mailpit -c 'rm -f /data/mailpit.db*'
compose up -d mailpit

echo "✓ $BRIO_DOMAIN reset: empty database, catalogue ingested, Mailpit empty."
