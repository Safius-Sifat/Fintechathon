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
