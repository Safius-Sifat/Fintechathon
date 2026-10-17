#!/usr/bin/env bash
set -euo pipefail
image=${1:?image required}
name="mandate-smoke-$RANDOM-$$"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$name" "$image" >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$name" node -e 'fetch("http://127.0.0.1:3000/healthz").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))' 2>/dev/null; then
    # Foundation liveness must never be presented as financial readiness.
    docker exec "$name" node -e 'fetch("http://127.0.0.1:3000/readyz").then(r=>{if(r.status!==503)process.exit(1)}).catch(()=>process.exit(1))'
    exit 0
  fi
  sleep 1
done
exit 1
