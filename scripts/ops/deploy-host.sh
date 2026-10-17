#!/usr/bin/env bash
# Installed once as /opt/mandate/bin/deploy; run as mandate-deploy, never on an MPC host.
set -euo pipefail
umask 077
commit=${1:?tested commit required}
[[ "$commit" =~ ^[a-f0-9]{40}$ ]] || exit 2
base=/opt/mandate
mkdir -p "$base/state" "$base/releases" "$base/deployments" "$base/logs"
exec 9>"$base/state/deploy.lock"
flock -n 9 || { echo 'Another deployment is running'; exit 1; }
# Keep private diagnostics off Azure Run Command stdout.
exec 3>&1
exec >>"$base/logs/$commit.log" 2>&1
trap 'echo "Deployment failed; inspect private host log" >&3' ERR
[[ ! -f "$base/state/needs-reconciliation" ]] || { echo 'Reconcile previous interrupted deployment before retry'; exit 1; }
source_repo="$base/source"
git -C "$source_repo" fetch origin main
git -C "$source_repo" merge-base --is-ancestor "$commit" origin/main
[[ "$(git -C "$source_repo" rev-parse origin/main)" == "$commit" ]] || { echo 'Superseded main commit'; exit 1; }
release="$base/releases/$commit"
if [[ ! -d "$release" ]]; then git -C "$source_repo" worktree add --detach "$release" "$commit"; fi
cd "$release"
[[ "$(node --version)" == v22.23.3 ]]
[[ "$(pnpm --version)" == 10.20.0 ]]
pnpm install --frozen-lockfile
mode=$(cat /opt/mandate/config/release-mode)
[[ "$mode" == foundation || "$mode" == wallet ]]
node scripts/ops/load-secrets.mjs
manifest=''
if [[ "$mode" == wallet ]]; then
  [[ -f packages/contracts/foundry-version.txt ]]
  [[ "$(forge --version | head -n 1)" == "$(cat packages/contracts/foundry-version.txt)" ]]
  make check-schema check-contracts check-platform check-agents
  [[ -f packages/contracts/script/Deploy.s.sol && -f deployments/config.base-sepolia.json ]]
  set -a
  source "$base/private/deploy.env"
  set +a
  [[ -n "${BASE_SEPOLIA_RPC_URL:-}" && -r "$base/private/deployer-password" ]]
  export DEPLOYMENT_CONFIG="$release/deployments/config.base-sepolia.json"
  fingerprint=$( { git ls-files -z packages/contracts/src packages/contracts/script packages/contracts/foundry.toml packages/contracts/foundry.lock packages/contracts/foundry-version.txt packages/contracts/package.json deployments/config.base-sepolia.json | sort -z | xargs -0 sha256sum; } | sha256sum | cut -d' ' -f1 )
  record="$base/deployments/$fingerprint.json"
  manifest="$base/deployments/$fingerprint.manifest.json"
  if [[ ! -f "$record" ]]; then
    printf '%s\n' "$commit contracts" > "$base/state/needs-reconciliation"
    forge script --root packages/contracts script/Deploy.s.sol:Deploy --rpc-url "$BASE_SEPOLIA_RPC_URL" --account mandate-testnet-deployer --password-file "$base/private/deployer-password" --broadcast
    node --import tsx scripts/ops/deployment-manifest.mjs create deployments/config.base-sepolia.json "$manifest"
    cp deployments/config.base-sepolia.json.record "$record"
    rm "$base/state/needs-reconciliation"
  else
    node --import tsx scripts/ops/deployment-manifest.mjs verify "$record" "$manifest"
  fi
  chmod 0644 "$manifest"
  cp "$manifest" deployments/base-sepolia.json
fi
image="mandate-api:$commit"
docker build --tag "$image" .
image=$(docker image inspect --format '{{.Id}}' "$image")
# Host backup helper must create a readable pg_dump custom-format archive and exit nonzero on failure.
# Install from this repo, configure private connection/TLS once; no migrations without backup.
bash scripts/ops/backup-db.sh "$commit"
printf '%s\n' "$commit migrations" > "$base/state/needs-reconciliation"
docker run --rm --user "$(id -u):$(id -g)" --network host --env-file "$base/private/migration.env" \
  --mount "type=bind,src=$base/private/db-ca.crt,dst=/run/db-ca.crt,readonly" \
  -e APP_ENV=production -e MIGRATION_CA_FILE=/run/db-ca.crt \
  "$image" packages/platform/node_modules/.bin/tsx packages/platform/src/migrate.ts
# Expansion-only migrations keep the previous backend compatible. Never run SQL down migrations.
export MANDATE_IMAGE="$image" MANDATE_MANIFEST="$manifest" MANDATE_COMMIT="$commit"
export MANDATE_UID="$(id -u)" MANDATE_GID="$(id -g)"
compose_file="$release/infra/release/compose.$mode.yaml"
previous_image=''; previous_manifest=''; previous_commit=''; previous_mode=''
if [[ -f "$base/state/current" ]]; then read -r previous_image previous_manifest previous_commit previous_mode < "$base/state/current"; [[ "$previous_manifest" != - ]] || previous_manifest=''; fi
compose=(docker compose -f "$compose_file")
"${compose[@]}" up -d --no-build
healthy=false
for attempt in $(seq 1 30); do
  if node -e 'fetch("http://127.0.0.1:3000/healthz",{signal:AbortSignal.timeout(3000)}).then(async r=>{if(!r.ok||(await r.json()).revision!==process.argv[1])process.exit(1)}).catch(()=>process.exit(1))' "$commit"; then
    if [[ "$mode" == foundation ]]; then
      if node -e 'Promise.all([fetch("http://127.0.0.1:3000/readyz"),fetch("http://127.0.0.1:3000/deployment.json")]).then(rs=>{if(rs.some(r=>r.status!==503))process.exit(1)}).catch(()=>process.exit(1))'; then healthy=true; break; fi
    elif curl --fail --silent --max-time 5 http://127.0.0.1:3000/deployment.json > "$base/state/served.json" &&
      node -e 'const fs=require("fs");if(JSON.stringify(JSON.parse(fs.readFileSync(process.argv[1])))!==JSON.stringify(JSON.parse(fs.readFileSync(process.argv[2]))))process.exit(1)' "$manifest" "$base/state/served.json" &&
      curl --fail --silent --max-time 5 http://127.0.0.1:3000/readyz >/dev/null; then healthy=true; break; fi
  fi
  sleep 2
done
if [[ "$healthy" != true ]]; then
  if [[ -n "$previous_image" ]]; then
    MANDATE_IMAGE="$previous_image" MANDATE_MANIFEST="$previous_manifest" MANDATE_COMMIT="$previous_commit" docker compose -f "$base/releases/$previous_commit/infra/release/compose.$previous_mode.yaml" up -d --no-build
  else "${compose[@]}" stop api; fi
  echo 'New backend unhealthy; previous backend restored where available; reconcile release state'
  exit 1
fi
printf '%s %s %s %s\n' "$image" "${manifest:--}" "$commit" "$mode" > "$base/state/current.tmp"
mv "$base/state/current.tmp" "$base/state/current"
rm "$base/state/needs-reconciliation"
echo "MANDATE_DEPLOY_OK $commit" >&3
