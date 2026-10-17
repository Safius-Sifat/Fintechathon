#!/usr/bin/env bash
set -euo pipefail
umask 077
commit=${1:?commit required}
[[ "$commit" =~ ^[a-f0-9]{40}$ ]]
base=/opt/mandate
# libpq variables: PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSFILE/PGSSLROOTCERT, PGSSLMODE=verify-full.
set -a
source "$base/private/backup.env"
set +a
[[ "${PGSSLMODE:-}" == verify-full && -r "${PGPASSFILE:-}" && -r "${PGSSLROOTCERT:-}" ]]
mkdir -p "$base/backups"
file="$base/backups/$(date -u +%Y%m%dT%H%M%SZ)-$commit.dump"
pg_dump --format=custom --file="$file.tmp"
[[ -s "$file.tmp" ]]
pg_restore --list "$file.tmp" > /dev/null
mv "$file.tmp" "$file"
node "$(dirname "$0")/upload-backup.mjs" "$file"
# Keep seven days locally; Azure soft-delete/versioning protects off-VM copies.
find "$base/backups" -maxdepth 1 -name '*.dump' -type f -mtime +7 -delete
# Archive validation is not a restore drill. Restore rehearsals are required before demo activation.
