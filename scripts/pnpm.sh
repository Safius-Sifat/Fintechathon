#!/bin/sh
set -eu
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_root"
if [ "$(node -v 2>/dev/null || true)" = "v22.23.3" ] && [ "$(pnpm --version 2>/dev/null || true)" = "10.20.0" ]; then
  exec pnpm "$@"
fi
printf '%s\n' 'Using pinned Node22.23.3 and pnpm10.20.0 through npm exec (no global installation changes).'
export npm_config_cache="${npm_config_cache:-$project_root/.cache/toolchain/npm}"
exec npm exec --yes --package=node@22.23.3 --package=pnpm@10.20.0 -- pnpm "$@"
