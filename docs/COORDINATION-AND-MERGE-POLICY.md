# Team coordination and merge rules

**Status:** team rule for the four implementation plans.  
**Language:** ASD-STE100 style.  
**Main branch:** `main`.

## 1. Purpose

This document tells each owner how to work with the other owners. It defines the shared interfaces, work order, review rules and merge rules.

Use this document with the four [implementation plans](plans/).

## 2. Owners

| Owner | Owns | Must coordinate with |
| --- | --- | --- |
| Person 1 | Contracts, shared schemas, ABI, test fixtures and deployment manifest | Persons 2, 3 and 4 when a shared interface changes |
| Person 2 | API, database, policy, worker, MPCium and transaction relay | Persons 1 and 4 for payments and evidence; Person 3 for app APIs |
| Person 3 | Android app, local owner key, native signing and app screens | Persons 1 and 2 for signatures, wallet calls and API data; Person 4 for activity and demo screens |
| Person 4 | Agent runbooks, SDK, MCP, services, inspector and demo | Persons 1 and 2 for payments and evidence; Person 3 for app display |

Each owner is responsible for code, tests, instructions and evidence in their plan. A person can help another owner. The owner of a component remains responsible for its result.

## 3. Shared interfaces

The shared interface has one source. Do not copy it into a separate package or change it in one component only.

| Interface | Source owner | Required consumers |
| --- | --- | --- |
| Contract methods, events, typed data, hashes, ABI and chain rules | Person 1 | Persons 2, 3 and 4 |
| JSON schemas, field names, integer units, status names and test vectors | Person 1 | Persons 2, 3 and 4 |
| API routes, request and response schemas, errors and database effects | Person 2 | Persons 3 and 4; Person 1 for contract work |
| Native bridge calls, app states and confirmation text | Person 3 | Persons 2 and 4 |
| Agent runbook inputs and outputs, evidence export and verifier result | Person 4 | Persons 1, 2 and 3 |
| Deployment manifest fields and address verification rules | Person 1 | Persons 2, 3 and 4 |

Store shared schemas and vectors in `packages/schema`. Store contract code and ABI in `packages/contracts`. Store API definitions beside the API source. Store native bridge definitions beside the Android source. Store evidence definitions and verifier fixtures in the Person 4 paths named in that plan.

Before a consumer uses a new interface, the source owner must publish:

1. The version and source file.
2. One valid example and one rejected example.
3. The exact integer units and address or hash format.
4. The expected error and state changes.
5. A test that checks the example.

Every consumer must test the same example. Do not use a local replacement fixture.

## 4. Work order

Use these gates. Work can continue in parallel when the gate allows it.

| Gate | Lead | Required result before the next gate |
| --- | --- | --- |
| W0 — Freeze interfaces | Person 1 | Schemas, typed data, ABI names, API samples, native bridge samples, receipt fields and manifest fields are in the repository. Each consumer records acceptance in its PR. |
| W1 — Build components | Each owner | Each component passes its own tests against the W0 samples. Owners do not wait for a full application before they open PRs. |
| W2 — Connect components | Persons 1 and 2 | The contract and API work on a local chain and a test database. The Android app and agent clients use the same API and schema. |
| W3 — Test the full flow | Person 4 coordinates | A test owner permit, policy decision, payment, provider result and evidence inspection. Record real testnet transaction hashes for testnet runs. |
| W4 — Release | All owners | Required tests pass. The app, backend, contracts and evidence use the same versioned interfaces. Record all known gaps. |

An owner can work on code before W0 if the owner uses a sample from the plan. The owner must update the code and tests to the W0 interface before merge.

## 5. Branch and pull request rules

1. Start from the latest `main`.
2. Create one branch for one change. Use `work/person1-contracts`, `work/person2-policy`, `work/person3-mobile` or `work/person4-demo` as a prefix. Add a short task name.
3. Do not push commits to `main`. Do not force-push a shared branch.
4. Open a draft pull request early. Name the owner and the receiving owners.
5. Keep the pull request small. One pull request must have one main result. Split unrelated changes.
6. Keep each pull request up to date with `main`. Resolve conflicts with the owner of the changed interface.
7. Use squash merge after approval and checks. Do not merge a draft pull request.

Every pull request must state:

- The owner and task IDs.
- The files and result.
- The interface version or `none`.
- The tests and exact results.
- The database migration and rollback effect, or `none`.
- The deployment effect, or `none`.
- The known gaps and next owner.

Use the repository pull request template. Do not write secret values, owner recovery words, private keys or MPC shares in a pull request.

## 6. Review and merge rules

Merge a pull request only when all these conditions are true:

1. It is not a draft.
2. `Repository tests` passes for the latest commit in the pull request.
3. One other team member approves it.
4. Every owner of a changed shared interface approves the interface change.
5. All review comments are resolved.
6. The pull request records the required test and deployment evidence.

Apply these extra rules to a high-risk change. A high-risk change includes a contract, signature, key, policy, authentication, permission, database migration, MPC, asset movement or evidence-verifier change.

- A second team member must review the change. The author cannot approve their own pull request.
- The contract, policy and app owners must approve any change that alters the signed fields or on-chain permission rules.
- Every affected consumer must pass its tests against the new interface.
- Do not merge a migration that deletes data or requires a database rollback.
- Do not merge a contract change until the test suite passes on a local chain. Deploy to Base Sepolia only through the release workflow.

### Before all team accounts are set up

The current repository rules require a pull request and passing `Repository tests`. They do not require an approval. The other owners do not yet have GitHub identities in `.github/team.json`.

Until the team accounts and reviewer rules are active:

- Owners can prepare branches and open draft pull requests.
- Do not merge a contract, signature, policy, key, authentication, permission, migration, MPC or evidence-verifier change.
- A documentation or test-only pull request can merge after CI passes and a team member checks it in writing in the pull request.
- Add each owner to `.github/team.json`, update `CODEOWNERS`, and set one required approval before normal code merges begin.

Do not state that independent review is active until GitHub enforces the reviewer rule.

## 7. Main branch and deployment

`main` must contain code that passes its required tests. Every merge to `main` starts the main-branch workflow.

The current workflow checks the repository, types, operations, migrations and database tests. It builds and smoke-tests the API container. After those checks pass, it deploys the tested API commit to Azure. The VM takes a database backup before it runs a migration. The VM checks the API and its database connection after deployment.

The current release mode is `foundation`. It does not deploy contracts. It reports incomplete financial readiness. Do not change the release mode to `wallet` until the contract, manifest, keys, tests, and all release gates in the plans exist and pass.

When wallet mode is ready, the release workflow must deploy only to Base Sepolia. It must use the dedicated testnet deployer key from the host secret store. It must verify the chain, transaction receipt and bytecode. It must publish the actual addresses and code hashes in the manifest. It must fail if a required check fails. Never put the deployer key in GitHub source or in the mobile app.

Contract transactions cannot be rolled back. A failed backend release can restore the previous compatible API image. It cannot undo a contract deployment or reverse an applied migration. Record a recovery action for each such change before merge.

## 8. Interface change steps

Use these steps when an interface must change:

1. Open an issue. State the reason and list every consumer.
2. Person 1 updates the canonical schema, ABI or manifest. The interface owner updates the canonical API or native bridge definition.
3. Add a new version or migration. Do not change a version that is already in use.
4. Add valid and rejected examples. Update the shared tests.
5. Get approval from every affected owner.
6. Update all consumers. Keep old and new versions working during the transition if stored data or signed messages use the old version.
7. Merge the interface and consumer changes in a planned sequence. State the required order in each pull request.

Do not change the meaning of a signed message, stored receipt or deployed contract at the same version.

## 9. Stop and escalation rules

Stop the merge if a test fails, an owner does not accept an interface, a required key or host is missing, or an operation has an unknown chain result.

The owner who finds the issue must open or update an issue. State:

- What failed.
- What evidence is missing.
- Which owner must act.
- Which work can continue without this result.

Other owners can continue work that uses the last accepted interface. Do not replace a missing component with a mock and report it as complete.

## 10. Release evidence

For each release, record:

- The main commit and the workflow run.
- The schema, API and manifest versions.
- The test results and known gaps.
- The testnet chain ID, transaction hashes and explorer links.
- The database migration and backup result.
- The app build and installation result.
- The evidence-inspector result.

Label local tests, testnet runs and untested claims separately. A green foundation workflow does not prove that wallet, MPC, agent or contract features work.
