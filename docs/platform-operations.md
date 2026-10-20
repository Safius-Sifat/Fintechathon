# Person2 continuation handoff — 2026-10-20

Source for the executed suites: `6676e6f4376bd4e827ab63861beb9b0d9c01587b` (base `e1c093d979250292c142d9cb91272f9d2fc8ece8`). Shared-schema source: `04f80a06aef361b305d20f6e371862939a4ec1ba`. This handoff covers API fixture parity and honest auth evidence. M0/W0, financial readiness and MPC qualification remain incomplete.

## Delivered evidence and consumer parity

`apps/api/test/golden-vectors.test.ts` imports validation, typed-data construction, hashes and recovery from `@mandate/schema`. The API's existing `test/*.test.ts` check discovers it; the database suites remain under `test/db`. There are no copied authority definitions, regenerated expected values, fixture edits or signing keys in the new suite.

| Shared fixture | Valid | Negative/mutation |
| --- | ---: | ---: |
| `login-v7.json` | 1 | 9 |
| `owner-transfer-v7.json` | 2 | 8 |
| `admin-v7.json` | 2 | 7 |
| `action-v7.json` | 2 | 7 |

All seven supplied signatures recover the fixture's expected signer. Each valid entry checks exact struct hash, domain separator, digest, ABI encoding, viem typed digest and JSON typed-data equality. Every rejection/mutation entry is independently reported: schema/domain rejects must throw, changed messages must change the digest and signer, and reordered field definitions must fail signer parity. Reordering intentionally uses the fixture's mutated type order after shared message/domain validation. No schema discrepancy was observed.

`evidence/person2/cases/P2-03.json` and `P2-W01.json` now each contain seven mandatory case records. The original task summaries and progress are preserved verbatim in `evidence/person2/history/`; their old source/schema identities remain historical and are not relabelled as current runs. Current logs and exact command/timing/source metadata are in `evidence/person2/artifacts/handoff-2026-10-20/`.

| Task | Release PASS | LOCAL_PASS | BLOCKED |
| --- | ---: | ---: | ---: |
| P2-03 | 0 | 0 | 7 |
| P2-W01 | 0 | 6 | 1 |

P2-03.T01/T02/T05 and P2-W01.T06 attach narrower `localChecks` with `LOCAL_PASS` results. Session revocation idempotency is not financial business/outbox acceptance. T06 did not create an active Permit or agent token. The six W01 `LOCAL_PASS` records describe backend-only observations and retain their native/chain limitations.

The current release checker reads arrays of case records. Only well-formed `PASS` records count toward release; `LOCAL_PASS`, `BLOCKED`, `NOT_RUN` and absent records leave mandatory cases missing. A `FAIL` produces release failure. `LOCAL_PASS` follows the existing P1-06.T05 convention and is deliberately insufficient for whole-case release acceptance. Unexecuted full cases have null command/exit/times; nested local checks carry the actual successful run metadata. No gate change was made.

## Executed checks

Use Node 22.23.3/pnpm 10.20.0 with `./scripts/pnpm.sh`; this run used those pinned binaries from the primary checkout's existing toolchain. Install locked dependencies into this checkout (`./scripts/pnpm.sh install --filter @mandate/api... --frozen-lockfile`). The isolated worktree has its own installed dependencies. Its ignored PostgreSQL test tool may point to the existing pinned test binaries; it never uses a user's database. Initial offline/cache and sandbox socket setup failures are not behavior failures or acceptance passes.

| Command | Exit | Observed |
| --- | ---: | --- |
| `./scripts/pnpm.sh --filter @mandate/api check` | 0 | Typecheck and 42 tests pass: 4 existing config + 38 new vector cases |
| `./scripts/pnpm.sh test:db` | 0 | 29 tests pass, 0 skipped; real disposable PostgreSQL 16.10, TLS verified; 19 API + 10 migration tests (including pool cleanup tests) |
| `./scripts/pnpm.sh --filter @mandate/platform typecheck` | 0 | Typecheck passes; not security qualification |
| `./scripts/pnpm.sh exec node --import tsx --test 'packages/platform/test/*.test.ts'` | 0 | 16 local configuration/migration-runner tests pass |
| `./scripts/pnpm.sh --filter @mandate/platform check` | 0 | No `check` script; no tests discovered. This is **not acceptance** |
| `make check-platform` | 2 | Bootstrap implementation gate remains unavailable |
| `./scripts/pnpm.sh release:check` | 1 | INCOMPLETE; 71/342 mandatory cases PASS, manifest missing; Person2 evidence has no invalid files after conversion |

The database runner creates a temporary database/password/TLS certificate, runs both DB suites and removes the instance. It requires local socket/shared-memory permissions; the `tsx` CLI also needs local IPC access. Public artifacts contain test names, assertions and metadata, with no refresh credentials or database passwords.

## Pending signer, anchor and chain checks

- Person2 must qualify the actual pinned MPCium build, DKG, intended quorum, authorizer denial, exact digest/signature encoding and recovery/outage behavior before any readiness claim. Shared-schema fixture recovery does not exercise MPC signing.
- Person2 must implement financial business state/idempotency/outbox, canonical wallet provisioning and executor matching, local inhibit and receipt ordering, worker leases/reservations and actual owner-operation relays. P2-03 stays in progress.
- Person3/Person2 must execute native Login2/NativeSession exchange, single-flight refresh/re-login recovery, independent local wallet behavior through logout/expiry/API outage and account switching. P2-W01 stays in progress; the exact existing API responses/re-login contract are in [OWNER-SESSIONS.md](api/OWNER-SESSIONS.md).
- Person2 must build checkpoint/anchor publication and verify configured chain, trusted manifest, contract code/wiring, publisher authorization, receipt inclusion/finality and independent readback. Public anchor publisher: `0x5cCEfD0Ac77088d72d38047856f4045E5ae56a95`. This address is configuration context; no publisher signing or credential is needed for this handoff.
- Actual Base Sepolia action/payment/admin/owner-transfer and active Permit/token logout/stop checks remain unexecuted by this change. `/readyz` continues to return 503; fixture parity does not satisfy it.

No migration or runtime behavior changed here. Existing fresh-start/migration and forward-only recovery instructions remain in [SETUP.md](SETUP.md) and [OWNER-SESSIONS.md](api/OWNER-SESSIONS.md). No deployment, funding, signing, backup restoration, Docker startup or chain transaction was performed for this handoff.

## Local three-node MPC qualification — 2026-10-20

This milestone supplies Go adapter/authorizer boundary packages and an isolated
qualification command. Financial signing readiness remains unavailable until the
immutable Action/Permit/Invoice/reservation store, durable attempt journal,
independent RPC financial policy and worker integration exist. No signing HTTP
endpoint is enabled. The qualification fixture source is explicitly disposable;
it consumes only checked-in Action vectors recomputed by the authoritative shared
TypeScript helper. Its leading-zero digest is a separately labelled raw32 test
vector, not a new valid on-chain Action.

From any working directory, set `REPO` to this checkout's absolute path:

```sh
REPO=/absolute/path/to/fintechathon
"$REPO/infra/scripts/build-mpc.sh"
export MPC_NODE_IMAGE=sha256:ACTUAL_IMAGE_ID_PRINTED_ABOVE
export MPC_PRIVATE_DIR=/opt/mandate/private/mpc
python3 "$REPO/infra/scripts/setup-mpc-qualification.py"
"$REPO/infra/scripts/qualify-mpc.sh"
```

On macOS use an absent directory below `/private/tmp` instead of `/opt`. Setup
refuses existing paths and never overwrites identities. It invokes the pinned
`mpcium-cli generate-peers -n 3 --output ...`, `generate-identity --node nodeN
--peers ... --output-dir ... --encrypt`, `generate-initiator --node-name
mandate-adapter-a --output-dir ... --encrypt`, and `generate-authorizer --name
mandate-policy-v1 --output-dir ... --encrypt`. CLI password prompts use a private
PTY; passwords and encrypted identity files remain outside Git and image layers.
Each node sees only its own encrypted private identity and all peers' public
identity files; distinct Docker share volumes contain encrypted Badger data and
backups. Every node uses the same generated32-byte chain code and threshold1,
with keygen/sign concurrency1 and mandatory authorizer `mandate-policy-v1`.

The image builds the untouched lock commit with Go1.25.8, `CGO_ENABLED=0`, Linux
and the Docker engine's architecture. The pinned Golang build/runtime base and
NATS/Consul image digests are in `compose.mpcium.yaml` and `Dockerfile.mpcium`.
Build inputs contain only the compiled node binary. Retain upstream Apache2.0
LICENSE; this integration is not a cryptographic audit.

The dedicated bridge has no node host ports. NATS14222 and Consul18500 bind only
127.0.0.1. NATS requires a generated local certificate plus username/password;
actual wrong-credential denial is tested. Consul uses ACL default deny and the
transport check asserts anonymous read/write/service-registration denial and
encoded traversal rejection. This isolated qualification currently uses its own
bootstrap ACL token for node KV operations; split administrative/bootstrap and
restricted node tokens before production deployment. TLS is exercised for NATS;
Consul HTTP is limited to the dedicated bridge and host loopback. Local transport
certificates expire after two days. Host disk encryption/firewall and public
interface reachability must be qualified on the actual Azure host.

Consul1.21.5 rejected MPCium's scoped `threshold_keyinfo/CLIENT:WALLET` keys with
HTTP500; the first failure is preserved. The compatible pinned Consul1.22.7 keeps
`disable_kv_key_validation=false`. Its official `validateKVKey` accepts a colon
and rejects encoded traversal. No MPCium source or cryptographic code was
modified. See [HashiCorp KV docs](https://developer.hashicorp.com/consul/docs/automate/kv/store)
and [v1.22.7 source](https://github.com/hashicorp/consul/blob/v1.22.7/agent/kvs_endpoint.go).
Current Fystack installation docs show threshold2, while its security docs say
t+1. At pinned commit90e3ee3, `sign_consumer.go` requires configured threshold+1
and `config.prod.yaml.template` uses1. Local qualification uses1 and reports
actual pair/single results; it does not import current docs' example value.

`qualify-mpc.sh` checks the source pin/configuration, builds the upstream-client
CLI, subscribes before publish, uses stable client ID `mandate-adapter-a` with an
exclusive local process lock, and runs twenty fresh signatures, all pairs, each
single signer, one/two outages, restart and missing/wrong/mutated authorizations.
Wrong/late result IDs and signatures are covered in Go tests. All results bind
wallet+attempt+network and recover the registered executor on the exact stored32
bytes; upstream results do not carry a digest/keyVersion, so immutable attempt
lookup and cryptographic recovery supply that binding. Fresh MPC signatures need
not equal the fixed-account fixture bytes. Production `Store.Begin` must enforce
unique attempts and durable executor exclusion; timeout remains SIGNING_UNKNOWN,
with reservation retained until reconciliation. The adapter exposes only
`SignAction(actionId)` to its application caller.

Raw CLI output goes into private run directories. Public reports contain only
public vectors, IDs, timings and hashes. The script restores all three signers in
its dedicated project even when a case fails; it does not remove volumes. To stop
only this project, preserve the exported variables and run:

```sh
docker compose -f "$REPO/infra/release/compose.mpcium.yaml" down
```

Do not use `down -v` unless deliberately destroying these disposable shares.
These qualification identities/executor are test material and must never be
registered for a funded production wallet. The local Docker engine has about8GiB
and10CPUs; the actual Azure2CPU/4GiB full-stack fit and public Base Sepolia outage
payment drill remain unqualified. No publisher key was accessed and no transaction
was broadcast. A VM administrator remains able to access all shares and the
policy key; this single-host PoC does not resist host compromise.

Fast CI, after `build-mpc.sh` or an exact verified upstream checkout and normal
workspace installation:

```sh
GOTOOLCHAIN=go1.25.8 go -C "$REPO/services/mpc-boundary" test -race -count=1 ./...
GOTOOLCHAIN=go1.25.8 go -C "$REPO/services/mpc-adapter" test -race -count=1 ./...
GOTOOLCHAIN=go1.25.8 go -C "$REPO/services/mpc-authorizer" test -race -count=1 ./...
GOTOOLCHAIN=go1.25.8 go -C "$REPO/services/mpc-boundary" vet ./...
GOTOOLCHAIN=go1.25.8 go -C "$REPO/services/mpc-adapter" vet ./...
GOTOOLCHAIN=go1.25.8 go -C "$REPO/services/mpc-authorizer" vet ./...
"$REPO/scripts/pnpm.sh" --filter @mandate/schema exec tsc --noEmit -p "$REPO/services/mpc-adapter/internal/qualification/tsconfig.json"
docker compose -f "$REPO/infra/release/compose.mpcium.yaml" config --quiet
```

The compose check needs valid `MPC_PRIVATE_DIR` and immutable `MPC_NODE_IMAGE`
values but starts nothing. Real DKG is the separate explicit qualification script;
fast unit CI cannot establish financial or public-chain readiness.

Post-denial queue recovery (resolved 2026-10-20, LOCAL_PASS). The earlier BLOCKED
result was head-of-line blocking, not a stuck node. Source: pinned
`event_consumer.go` returns without a reply when initiator or authorizer
verification fails; `sign_consumer.go` then holds the JetStream message for its 45s
reply window, NAKs, and the shared durable consumer redelivers it (MaxDeliver 4,
30s backoff) with `MaxAckPending = max_concurrent_signing = 1`. Each unauthorized
request therefore occupies the only signing slot for about 181s before the
max-delivery advisory produces an error result. Measured with
`qualify post-denial-recovery` (three denials then one valid request in one adapter
session): denials resolved DENIED at 181s/362s/543s and the valid request signed
and recovered the executor 0.6s after the slot freed. An idle-cluster valid request
signed in about 1s. The 90s qualifier timeout was shorter than the queue.

Operational consequences:
- Availability, not safety: no denied request produced a signature. A holder of the
  shared NATS credential can stall signing about 181s per unauthorized message.
  The qualification NATS config uses one user with publish `>`; per-identity users
  with adapter-only publish on `mpc.signing_request.*` are an open hardening item.
- The adapter only publishes requests the authorizer already signed, so denials
  come from compromise or misconfiguration, not routine policy rejections.
- An adapter timeout is SIGNING_UNKNOWN: a queued valid request can still sign after
  the adapter stops waiting, so the reservation stays and no fresh attempt starts
  until the late result or reconciliation resolves it.
No stream purge, custom nonce/session restoration or cryptographic patch was used.

## Financial runtime (Person2, local qualification 2026-10-20)

Processes (all loopback except the API's documented HTTPS ingress):
`apps/api` (owner/agent routes), `apps/worker` (jobs, executor, relays, reconcile, sentinel),
`services/policy` (private policy check), `mandate-authorizer` and `mandate-adapter` (Go, MPC boundary),
three MPCium nodes with NATS/Consul (see the qualification section above).

Runtime configuration names (values live outside Git; see infra/secrets.example):
- API: `DATABASE_URL`, `DATABASE_CA_FILE`, `AUTH_ORIGIN`, `AUTH_JWT_SECRET_FILE`, `TRUSTED_MANIFEST_FILE`,
  `API_RPC_URL`, `EVIDENCE_KEY_FILE` (32-byte hex Ed25519 seed), `ARTIFACT_KEY_FILE` (32-byte hex AES key).
- Worker: `DATABASE_URL`, `DATABASE_CA_FILE`, `TRUSTED_MANIFEST_FILE`, `WORKER_RPC_URL`, `ADAPTER_URL`,
  `ADAPTER_INTERNAL_TOKEN_FILE`, `RISK_RULES_FILE`, `WORKER_SIGNING_ENABLED`, `ETHERSCAN_API_KEY` (optional),
  per lane `WORKER_{NORMAL,EMERGENCY,ANCHOR}_{KEYSTORE_FILE,PASSWORD_FILE,ADDRESS}` (Foundry/v3 keystores, owner-only files).
- Policy: `POLICY_DATABASE_URL`, `POLICY_DATABASE_CA_FILE` (read-only role), `POLICY_INTERNAL_TOKEN_FILE`,
  `TRUSTED_MANIFEST_FILE`, `POLICY_RPC_URL`, `SCREENING_LIST_FILE`, `POLICY_PORT`.
- Authorizer: `AUTHORIZER_LISTEN`, `AUTHORIZER_INITIATOR_PUBLIC_KEY`, `AUTHORIZER_KEY_FILE`,
  `AUTHORIZER_KEY_PASSWORD_FILE`, `POLICY_URL`, `POLICY_INTERNAL_TOKEN_FILE`, `AUTHORIZER_INTERNAL_TOKEN_FILE`.
- Adapter: `ADAPTER_LISTEN`, `ADAPTER_LOCK_FILE`, `ADAPTER_DATABASE_URL` (sslmode=verify-full, sslrootcert),
  `NATS_URL`, `NATS_USER`, `NATS_PASSWORD_FILE`, `NATS_TLS_DIR`, `INITIATOR_KEY_FILE`,
  `INITIATOR_KEY_PASSWORD_FILE`, `AUTHORIZER_URL`, `AUTHORIZER_INTERNAL_TOKEN_FILE`,
  `ADAPTER_INTERNAL_TOKEN_FILE`, `ADAPTER_SESSION_TIMEOUT` (default 15m, above the post-denial queue drain).

Manifest entries operators publish: `riskRules.hash`
0x51ca3d29b20018ac497c5b79d711521ef9f317c40787cfc690c9fa76bb8bae33 (services/policy/rules/risk-rules-v1.json),
`screening.listHash` 0xa6559eb9187ffa5065270e6c34be70e94d7f1b0083624a1492ce4b6d787def85
(services/policy/rules/demo-screening-v1.json). Processes refuse a mismatched file.

Readiness: `/readyz` stays 503 until release gates pass and lists named checks only (no values or errors).

Restore: restore DB and artifacts into an isolated environment with `WORKER_SIGNING_ENABLED` unset.
The worker then reconciles journaled transactions, late MPC results and reservations but starts no new
MPC request. Enable signing only after every SUBMITTED/UNKNOWN action and attempt is resolved against
the chain. Never restore mid-sign ephemeral MPC state as a session.

Lost signer: inhibit (any alert or admin draft), owner-signed PAUSE/REVOKE through the emergency lane
(no MPC needed), fresh per-wallet DKG with a new MPC wallet ID and a fresh owner Permit. No reshare,
no key reconstruction.

Fee lanes: normal 0.016 ETH/day, emergency 0.002 ETH/day, anchor 0.002 ETH/day, 0.0005 ETH per
transaction estimate (L1+L2 +20%). Fund each lane sender separately; the anchor lane signer must be
the deployed EvidenceAnchor publisher 0x5cCEfD0Ac77088d72d38047856f4045E5ae56a95 (password not configured:
public anchoring BLOCKED).

Tests: `pnpm test:db` (TLS Postgres + Base Sepolia fork; 82 cases), package checks for api/worker/policy,
Go `vet` + `test -race` for the three modules, and the MPC end-to-end
`MPC_PRIVATE_DIR=... node scripts/ops/with-test-postgres.mjs 'apps/worker/test/e2e/*.test.ts'`.
