-- Durable financial core (P2-03/P2-04/P2-05). Funds are numeric(78,0) bounded to uint256.
-- evidence_events is append-only in application code; a DB trigger needs a reviewed manual migration.

CREATE TABLE wallets (
  id uuid PRIMARY KEY,
  owner_address text CHECK (owner_address ~ '^0x[0-9a-f]{40}$') NOT NULL UNIQUE REFERENCES owner_identities(owner_address),
  provisioning_state text NOT NULL CHECK (provisioning_state IN ('DEPLOYING','KEYGEN','READY','FAILED')),
  wallet_address text CHECK (wallet_address ~ '^0x[0-9a-f]{40}$') UNIQUE,
  deployment_block numeric(20,0) CHECK (deployment_block >= 0 AND deployment_block < 18446744073709551616),
  code_hash text CHECK (code_hash ~ '^0x[0-9a-f]{64}$'),
  deployment_tx_hash text CHECK (deployment_tx_hash ~ '^0x[0-9a-f]{64}$'),
  mpc_wallet_id uuid UNIQUE,
  executor_address text CHECK (executor_address ~ '^0x[0-9a-f]{40}$'),
  executor_public_key text CHECK (executor_public_key ~ '^0x04[0-9a-f]{128}$'),
  key_version integer CHECK (key_version >= 1),
  paused boolean NOT NULL DEFAULT false,
  frozen boolean NOT NULL DEFAULT false,
  inhibited boolean NOT NULL DEFAULT false,
  epoch numeric(20,0) CHECK (epoch >= 0 AND epoch < 18446744073709551616) NOT NULL DEFAULT 0,
  policy_version numeric(20,0) CHECK (policy_version >= 0 AND policy_version < 18446744073709551616) NOT NULL DEFAULT 0,
  failure_reason text CHECK (length(failure_reason) <= 500),
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  CHECK (provisioning_state <> 'READY' OR (wallet_address IS NOT NULL AND deployment_block IS NOT NULL
    AND code_hash IS NOT NULL AND mpc_wallet_id IS NOT NULL AND executor_address IS NOT NULL
    AND executor_public_key IS NOT NULL AND key_version IS NOT NULL)),
  CHECK (provisioning_state <> 'KEYGEN' OR (wallet_address IS NOT NULL AND mpc_wallet_id IS NOT NULL)),
  CHECK (provisioning_state <> 'FAILED' OR failure_reason IS NOT NULL)
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  chain_task_id text CHECK (chain_task_id ~ '^0x[0-9a-f]{64}$') NOT NULL UNIQUE,
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  runbook_id text NOT NULL CHECK (runbook_id IN ('browser-check','liquidity-keeper','scheduled-pay','service-allowance')),
  goal text NOT NULL CHECK (length(goal) BETWEEN 1 AND 2000),
  input jsonb NOT NULL,
  outcome_state text NOT NULL CHECK (outcome_state IN ('DRAFT','AWAITING_OWNER','READY','RUNNING','AWAITING_AGENT','COMPLETED','DELIVERY_FAILED','NEEDS_OWNER','CANCELLED')),
  authority_state text NOT NULL CHECK (authority_state IN ('PENDING','ACTIVE','FROZEN','CLOSING','CLOSED','REVOKED','EXPIRED','INVALIDATED')),
  current_step text NOT NULL DEFAULT '' CHECK (length(current_step) <= 64),
  runbook_state jsonb NOT NULL,
  result jsonb,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE (id, wallet_id)
);
CREATE INDEX tasks_wallet ON tasks(wallet_id, created_at);

CREATE TABLE agent_tokens (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  owner_address text CHECK (owner_address ~ '^0x[0-9a-f]{40}$') NOT NULL REFERENCES owner_identities(owner_address),
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  task_id uuid,
  scopes text[] NOT NULL CHECK (cardinality(scopes) BETWEEN 1 AND 4 AND scopes <@ ARRAY['read','prepare','run','evidence']),
  expires_at bigint NOT NULL,
  revoked_at bigint,
  created_at bigint NOT NULL,
  CHECK (expires_at > created_at),
  FOREIGN KEY (task_id, wallet_id) REFERENCES tasks(id, wallet_id)
);

CREATE TABLE permit_drafts (
  id uuid PRIMARY KEY,
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  task_id uuid NOT NULL,
  typed_data jsonb NOT NULL,
  scope jsonb NOT NULL,
  digest text CHECK (digest ~ '^0x[0-9a-f]{64}$') NOT NULL,
  permit_id text CHECK (permit_id ~ '^0x[0-9a-f]{64}$') NOT NULL,
  nonce numeric(78,0) CHECK (nonce >= 0 AND nonce < 115792089237316195423570985008687907853269984665640564039457584007913129639936) NOT NULL,
  epoch numeric(20,0) CHECK (epoch >= 0 AND epoch < 18446744073709551616) NOT NULL,
  state text NOT NULL CHECK (state IN ('PENDING','ACTIVATED','SUPERSEDED','EXPIRED')),
  expires_at bigint NOT NULL,
  created_at bigint NOT NULL,
  FOREIGN KEY (task_id, wallet_id) REFERENCES tasks(id, wallet_id)
);
CREATE UNIQUE INDEX permit_drafts_one_pending ON permit_drafts(wallet_id) WHERE state = 'PENDING';

CREATE TABLE permits (
  permit_id text CHECK (permit_id ~ '^0x[0-9a-f]{64}$') PRIMARY KEY,
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  task_id uuid NOT NULL UNIQUE,
  draft_id uuid NOT NULL UNIQUE REFERENCES permit_drafts(id),
  permit jsonb NOT NULL,
  owner_signature text NOT NULL CHECK (owner_signature ~ '^0x[0-9a-f]{130}$'),
  activation_tx_hash text CHECK (activation_tx_hash ~ '^0x[0-9a-f]{64}$'),
  authority_state text NOT NULL CHECK (authority_state IN ('PENDING','ACTIVE','FROZEN','CLOSING','CLOSED','REVOKED','EXPIRED','INVALIDATED')),
  spend_cap numeric(78,0) CHECK (spend_cap >= 0 AND spend_cap < 115792089237316195423570985008687907853269984665640564039457584007913129639936) NOT NULL,
  period_cap numeric(78,0) CHECK (period_cap >= 0 AND period_cap < 115792089237316195423570985008687907853269984665640564039457584007913129639936) NOT NULL,
  period_seconds bigint NOT NULL CHECK (period_seconds >= 0),
  max_payment numeric(78,0) CHECK (max_payment >= 0 AND max_payment < 115792089237316195423570985008687907853269984665640564039457584007913129639936) NOT NULL,
  created_at bigint NOT NULL,
  FOREIGN KEY (task_id, wallet_id) REFERENCES tasks(id, wallet_id),
  UNIQUE (permit_id, wallet_id)
);

CREATE TABLE actions (
  id uuid PRIMARY KEY,
  task_id uuid NOT NULL,
  wallet_id uuid NOT NULL,
  permit_id text CHECK (permit_id ~ '^0x[0-9a-f]{64}$') NOT NULL,
  decision_key text NOT NULL CHECK (length(decision_key) BETWEEN 1 AND 128),
  request_id text CHECK (request_id ~ '^0x[0-9a-f]{64}$') NOT NULL,
  invoice_id text CHECK (invoice_id ~ '^0x[0-9a-f]{64}$') NOT NULL,
  operation smallint NOT NULL CHECK (operation BETWEEN 0 AND 6),
  asset text CHECK (asset ~ '^0x[0-9a-f]{40}$') NOT NULL,
  amount numeric(78,0) CHECK (amount >= 0 AND amount < 115792089237316195423570985008687907853269984665640564039457584007913129639936) NOT NULL,
  period bigint NOT NULL CHECK (period >= 0),
  action jsonb NOT NULL,
  digest text CHECK (digest ~ '^0x[0-9a-f]{64}$') NOT NULL UNIQUE,
  invoice jsonb,
  provider_signature text CHECK (provider_signature ~ '^0x[0-9a-f]{130}$'),
  CHECK ((invoice IS NULL) = (provider_signature IS NULL)),
  state text NOT NULL CHECK (state IN ('PROPOSED','RESERVED','AWAITING_APPROVAL','SIGNING','SIGNED','SUBMITTED','INCLUDED','FINALIZED','DENIED','REJECTED','REVERTED','UNKNOWN')),
  denial_code text,
  tx_hash text CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  FOREIGN KEY (task_id, wallet_id) REFERENCES tasks(id, wallet_id),
  FOREIGN KEY (permit_id, wallet_id) REFERENCES permits(permit_id, wallet_id),
  UNIQUE (task_id, decision_key),
  UNIQUE (wallet_id, request_id),
  UNIQUE (id, wallet_id)
);
CREATE UNIQUE INDEX actions_wallet_invoice ON actions(wallet_id, invoice_id)
  WHERE invoice_id <> '0x0000000000000000000000000000000000000000000000000000000000000000';
-- Schedule periods pay at most once per permit (operation TRANSFER with nonzero period).
CREATE UNIQUE INDEX actions_permit_period ON actions(permit_id, period) WHERE period > 0;

-- Reservation state: RESERVED (admitted, not included), UNKNOWN (possibly included),
-- INCLUDED (chain spend, counted from chain), RELEASED (proven unused/reverted).
CREATE TABLE reservations (
  action_id uuid PRIMARY KEY,
  wallet_id uuid NOT NULL,
  permit_id text CHECK (permit_id ~ '^0x[0-9a-f]{64}$') NOT NULL,
  asset text CHECK (asset ~ '^0x[0-9a-f]{40}$') NOT NULL,
  kind text NOT NULL CHECK (kind IN ('OUTFLOW','DEPOSIT','REDEEM')),
  amount numeric(78,0) CHECK (amount >= 0 AND amount < 115792089237316195423570985008687907853269984665640564039457584007913129639936) NOT NULL,
  chain_day bigint NOT NULL CHECK (chain_day >= 0),
  state text NOT NULL CHECK (state IN ('RESERVED','UNKNOWN','INCLUDED','RELEASED')),
  release_reason text CHECK (release_reason IN ('REVERTED','REJECTED','DENIED_UNSIGNED','INVALIDATED_RECONCILED')),
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  FOREIGN KEY (action_id, wallet_id) REFERENCES actions(id, wallet_id),
  FOREIGN KEY (permit_id, wallet_id) REFERENCES permits(permit_id, wallet_id),
  CHECK ((state = 'RELEASED') = (release_reason IS NOT NULL))
);
CREATE INDEX reservations_open ON reservations(wallet_id, permit_id) WHERE state IN ('RESERVED','UNKNOWN','INCLUDED');

CREATE TABLE signing_attempts (
  id uuid PRIMARY KEY,
  action_id uuid NOT NULL REFERENCES actions(id),
  mpc_wallet_id uuid NOT NULL,
  key_version integer NOT NULL CHECK (key_version >= 1),
  digest text CHECK (digest ~ '^0x[0-9a-f]{64}$') NOT NULL,
  executor_address text CHECK (executor_address ~ '^0x[0-9a-f]{40}$') NOT NULL,
  state text NOT NULL CHECK (state IN ('PENDING','SIGNED','UNKNOWN','DENIED','ABORTED')),
  signature text CHECK (signature ~ '^0x[0-9a-f]{130}$'),
  message_fingerprint text CHECK (message_fingerprint ~ '^[0-9a-f]{64}$'),
  error_code text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  CHECK ((state = 'SIGNED') = (signature IS NOT NULL))
);
-- One unresolved signing session per Action; UNKNOWN must be reconciled first.
CREATE UNIQUE INDEX signing_attempts_one_open ON signing_attempts(action_id) WHERE state IN ('PENDING','UNKNOWN');
CREATE UNIQUE INDEX signing_attempts_one_signed ON signing_attempts(action_id) WHERE state = 'SIGNED';

CREATE TABLE sender_lanes (
  lane text PRIMARY KEY CHECK (lane IN ('normal','emergency','anchor')),
  sender text CHECK (sender ~ '^0x[0-9a-f]{40}$') NOT NULL UNIQUE,
  next_nonce numeric(20,0) CHECK (next_nonce >= 0 AND next_nonce < 18446744073709551616) NOT NULL,
  daily_budget_wei numeric(78,0) CHECK (daily_budget_wei >= 0 AND daily_budget_wei < 115792089237316195423570985008687907853269984665640564039457584007913129639936) NOT NULL,
  per_tx_budget_wei numeric(78,0) CHECK (per_tx_budget_wei >= 0 AND per_tx_budget_wei < 115792089237316195423570985008687907853269984665640564039457584007913129639936) NOT NULL
);

CREATE TABLE transactions (
  id uuid PRIMARY KEY,
  lane text NOT NULL REFERENCES sender_lanes(lane),
  sender text CHECK (sender ~ '^0x[0-9a-f]{40}$') NOT NULL,
  nonce numeric(20,0) CHECK (nonce >= 0 AND nonce < 18446744073709551616) NOT NULL,
  chain_id integer NOT NULL CHECK (chain_id IN (84532, 31337)),
  action_id uuid REFERENCES actions(id),
  purpose text NOT NULL CHECK (purpose IN ('EXECUTE','ADMIN','OWNER_TRANSFER','POLICY','ACTIVATE','CREATE_WALLET','ANCHOR')),
  raw text NOT NULL CHECK (raw ~ '^0x([0-9a-f]{2})+$'),
  tx_hash text CHECK (tx_hash ~ '^0x[0-9a-f]{64}$') NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  replaces uuid REFERENCES transactions(id),
  state text NOT NULL CHECK (state IN ('JOURNALED','BROADCAST','UNKNOWN','INCLUDED','FINALIZED','REVERTED','REPLACED','DROPPED')),
  block_number numeric(20,0) CHECK (block_number >= 0 AND block_number < 18446744073709551616),
  block_hash text CHECK (block_hash ~ '^0x[0-9a-f]{64}$'),
  estimated_fee_wei numeric(78,0) CHECK (estimated_fee_wei >= 0 AND estimated_fee_wei < 115792089237316195423570985008687907853269984665640564039457584007913129639936) NOT NULL,
  actual_fee_wei numeric(78,0) CHECK (actual_fee_wei >= 0 AND actual_fee_wei < 115792089237316195423570985008687907853269984665640564039457584007913129639936),
  fee_day bigint NOT NULL CHECK (fee_day >= 0),
  journaled_at bigint NOT NULL,
  broadcast_at bigint,
  updated_at bigint NOT NULL,
  CHECK (state NOT IN ('INCLUDED','FINALIZED','REVERTED') OR (block_number IS NOT NULL AND block_hash IS NOT NULL))
);
-- Replacement keeps nonce; every hash in a nonce lineage is retained.
CREATE INDEX transactions_lane_nonce ON transactions(sender, nonce);
-- One original per sender nonce; fee replacements reference it and keep its nonce.
CREATE UNIQUE INDEX transactions_one_original_per_nonce ON transactions(sender, nonce)
  WHERE replaces IS NULL;

CREATE TABLE jobs (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_.]{2,63}$'),
  dedupe_key text NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('READY','LEASED','DONE','FAILED')),
  run_at bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 100),
  lease_owner text,
  lease_token uuid,
  lease_expires_at bigint,
  last_error text CHECK (length(last_error) <= 500),
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  UNIQUE (kind, dedupe_key),
  CHECK ((state = 'LEASED') = (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL AND lease_owner IS NOT NULL))
);
CREATE INDEX jobs_ready ON jobs(run_at) WHERE state IN ('READY','LEASED');

CREATE TABLE outbox (
  id bigserial PRIMARY KEY,
  topic text NOT NULL CHECK (topic ~ '^[a-z][a-z0-9_.]{2,63}$'),
  aggregate_id text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  created_at bigint NOT NULL,
  published_at bigint
);
CREATE INDEX outbox_unpublished ON outbox(id) WHERE published_at IS NULL;

CREATE TABLE idempotency_keys (
  tenant text CHECK (tenant ~ '^0x[0-9a-f]{40}$') NOT NULL REFERENCES owner_identities(owner_address),
  route text NOT NULL CHECK (route ~ '^/v1/[A-Za-z0-9/:_-]{1,120}$'),
  key uuid NOT NULL,
  body_hash text NOT NULL CHECK (body_hash ~ '^[0-9a-f]{64}$'),
  status integer NOT NULL CHECK (status BETWEEN 200 AND 299),
  response jsonb NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY (tenant, route, key)
);

CREATE TABLE evidence_events (
  task_id uuid NOT NULL REFERENCES tasks(id),
  sequence integer NOT NULL CHECK (sequence >= 0),
  event_id uuid NOT NULL UNIQUE,
  type text NOT NULL CHECK (type ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  event jsonb NOT NULL,
  prev_hash text CHECK (prev_hash ~ '^0x[0-9a-f]{64}$') NOT NULL,
  event_hash text CHECK (event_hash ~ '^0x[0-9a-f]{64}$') NOT NULL UNIQUE,
  dedupe_key text NOT NULL,
  PRIMARY KEY (task_id, sequence),
  UNIQUE (task_id, dedupe_key)
);

CREATE TABLE artifacts (
  task_id uuid NOT NULL REFERENCES tasks(id),
  artifact_id text NOT NULL CHECK (artifact_id ~ '^[A-Za-z0-9._-]{1,128}$'),
  media_type text NOT NULL CHECK (media_type IN ('image/png','text/plain','application/json')),
  sha256 text NOT NULL CHECK (sha256 ~ '^0x[0-9a-f]{64}$'),
  storage_commitment text CHECK (storage_commitment ~ '^0x[0-9a-f]{64}$') NOT NULL,
  byte_length integer NOT NULL CHECK (byte_length BETWEEN 0 AND 10485760),
  iv bytea UNIQUE CHECK (octet_length(iv) = 12),
  salt bytea CHECK (octet_length(salt) = 32),
  ciphertext bytea,
  expires_at bigint NOT NULL,
  deleted_at bigint,
  created_at bigint NOT NULL,
  PRIMARY KEY (task_id, artifact_id),
  CHECK ((deleted_at IS NULL) = (ciphertext IS NOT NULL AND iv IS NOT NULL AND salt IS NOT NULL))
);

CREATE TABLE checkpoints (
  task_id uuid NOT NULL REFERENCES tasks(id),
  sequence integer NOT NULL CHECK (sequence >= 0),
  checkpoint jsonb NOT NULL,
  signature text NOT NULL CHECK (signature ~ '^0x[0-9a-f]{128}$'),
  digest text CHECK (digest ~ '^0x[0-9a-f]{64}$') NOT NULL UNIQUE,
  anchor_tx_id uuid REFERENCES transactions(id),
  anchor_state text NOT NULL CHECK (anchor_state IN ('UNANCHORED','SUBMITTED','INCLUDED','FINALIZED','FAILED')),
  created_at bigint NOT NULL,
  PRIMARY KEY (task_id, sequence),
  FOREIGN KEY (task_id, sequence) REFERENCES evidence_events(task_id, sequence)
);

CREATE TABLE financial_alerts (
  id uuid PRIMARY KEY,
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  kind text NOT NULL CHECK (kind IN ('UNMATCHED_OUTFLOW','RISK','SCREENING','SIMULATION')),
  tx_hash text CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index integer,
  details jsonb NOT NULL,
  cleared_at bigint,
  created_at bigint NOT NULL,
  UNIQUE (wallet_id, kind, tx_hash, log_index)
);
