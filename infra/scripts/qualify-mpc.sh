#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
: "${MPC_PRIVATE_DIR:?set an existing isolated qualification directory outside Git}"
: "${MPC_NODE_IMAGE:?set the immutable image ID returned by build-mpc.sh}"
export MPC_DIGEST_OUTPUT="$MPC_PRIVATE_DIR/digests.json"
"$ROOT/scripts/pnpm.sh" --filter @mandate/schema exec tsx "$ROOT/services/mpc-adapter/internal/qualification/digest.ts"
(cd "$ROOT/services/mpc-adapter" && GOTOOLCHAIN=go1.25.8 go build -o "$ROOT/.cache/mpcium/bin/qualify" ./cmd/qualify)
exec python3 "$ROOT/infra/scripts/qualify-mpc.py"
