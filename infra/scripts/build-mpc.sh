#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
PIN=90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2
SOURCE="$ROOT/vendor/mpcium"
if [ ! -d "$SOURCE/.git" ]; then
  git clone https://github.com/fystack/mpcium "$SOURCE"
  git -C "$SOURCE" checkout --detach "$PIN"
fi
[ "$(git -C "$SOURCE" rev-parse HEAD)" = "$PIN" ]
[ -z "$(git -C "$SOURCE" status --porcelain)" ]
mkdir -p "$ROOT/.cache/mpcium/bin" "$ROOT/.cache/mpcium/image"
(cd "$SOURCE" && GOTOOLCHAIN=go1.25.8 go build -o "$ROOT/.cache/mpcium/bin/mpcium-cli" ./cmd/mpcium-cli)
ARCH=$(docker info --format '{{.Architecture}}')
case "$ARCH" in aarch64|arm64) ARCH=arm64;; x86_64|amd64) ARCH=amd64;; *) exit 1;; esac
(cd "$SOURCE" && GOTOOLCHAIN=go1.25.8 CGO_ENABLED=0 GOOS=linux GOARCH="$ARCH" go build -trimpath -o "$ROOT/.cache/mpcium/image/mpcium" ./cmd/mpcium)
docker build -f "$ROOT/infra/release/Dockerfile.mpcium" -t mandate-mpcium:$PIN "$ROOT/.cache/mpcium/image"
docker image inspect mandate-mpcium:$PIN --format '{{.Id}}'
