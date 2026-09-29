# shellcheck shell=bash
#
# Shared helpers for the deployed-environment scripts (ADR 0024). Sourced, never run:
#   . "$(dirname "$0")/lib.sh"
#
# Every script runs on the server, from the repository clone, against the stack
# started from docker-compose.prod.yml with deploy/.env.

set -euo pipefail

# Repository root, from this file's location: the scripts work from any directory
# and the clone can live anywhere.
BRIO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
BRIO_ENV_FILE="$BRIO_ROOT/deploy/.env"

# Where database dumps live. On the VPS, /var/backups/brio (created by bootstrap.sh);
# overridable to try the scripts elsewhere.
BRIO_SNAPSHOT_DIR=${BRIO_SNAPSHOT_DIR:-/var/backups/brio}

die() {
  echo "✗ $*" >&2
  exit 1
}

info() {
  echo "→ $*"
}

[ -f "$BRIO_ENV_FILE" ] || die "Missing $BRIO_ENV_FILE — copy deploy/.env.example and fill it in."

# Values the scripts read themselves (the containers get theirs through compose).
# Read one key at a time rather than sourcing: .env follows compose's syntax, not the
# shell's.
env_value() {
  local line
  line=$(grep -E "^$1=" "$BRIO_ENV_FILE" | tail -n 1) || true
  line=${line#*=}
  line=${line#\'}
  line=${line%\'}
  line=${line#\"}
  line=${line%\"}
  printf '%s' "$line"
}

BRIO_DOMAIN=$(env_value BRIO_DOMAIN)
[ -n "$BRIO_DOMAIN" ] || die "BRIO_DOMAIN is not set in $BRIO_ENV_FILE."

compose() {
  docker compose -f "$BRIO_ROOT/docker-compose.prod.yml" --env-file "$BRIO_ENV_FILE" "$@"
}

# psql / pg_dump / pg_restore run inside the postgres container, as the database
# owner the container was created with, so no credential is handled here. The command
# is expanded by the container's shell, where $POSTGRES_USER and $POSTGRES_DB are set.
pg_exec() {
  compose exec -T postgres sh -c "$1"
}

# restore and reset destroy the database. They refuse unless deploy/.env allows it
# (removed at publication, ADR 0024 §9) and the operator types the domain back.
require_reset_allowed() {
  [ "$(env_value BRIO_RESET_ALLOWED)" = "true" ] \
    || die "BRIO_RESET_ALLOWED=true is not set in deploy/.env: this environment's database must not be overwritten."
}

confirm_destruction() {
  local what=$1 assume_yes=$2 answer
  if [ "$assume_yes" = "true" ]; then
    return
  fi
  [ -t 0 ] || die "Refusing to $what without a terminal. Pass --yes to confirm."
  echo "This will $what on $BRIO_DOMAIN. Every account, class and message on it is lost."
  printf 'Type the domain to confirm: '
  read -r answer
  [ "$answer" = "$BRIO_DOMAIN" ] || die "Confirmation did not match — nothing was changed."
}

# Drop and recreate the application database. Backend and web must be stopped
# first; WITH (FORCE) still ends any leftover connection (psql sessions, a
# half-started container).
recreate_database() {
  info "Recreating the database"
  # shellcheck disable=SC2016 # expanded by the container's shell
  pg_exec 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\" WITH (FORCE)" \
    -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\""'
}

# The backend image has no HTTP client; the web image has node. Probe the backend
# from there, over the compose network. Actuator requires authentication outside the
# local profile, so the probe is the public catalogue: a 200 means the application is
# up and reads the database.
wait_for_backend() {
  local deadline=$((SECONDS + 240))
  info "Waiting for the backend to answer"
  until compose exec -T web node -e \
    "fetch('http://backend:8080/api/catalogue').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))" \
    >/dev/null 2>&1; do
    [ "$SECONDS" -lt "$deadline" ] || die "The backend does not answer after 4 minutes — see: docker compose logs backend"
    sleep 5
  done
  echo "✓ Backend up."
}
