-- Indexed public activity, per-account coverage and owner-registered hashes (P2-W02).
CREATE TABLE activity_events (
  activity_id text PRIMARY KEY CHECK (length(activity_id) BETWEEN 1 AND 128),
  owner_address text NOT NULL REFERENCES owner_identities(owner_address),
  source text NOT NULL CHECK (source IN ('PERSONAL','MANAGED')),
  category text NOT NULL CHECK (category IN ('INCOMING','OUTGOING','FUNDING','AGENT','VAULT','ADMIN','OWNER_CONTROL','CANCEL','SPEED_UP')),
  tx_hash text NOT NULL CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index integer CHECK (log_index >= 0),
  trace_id text CHECK (length(trace_id) <= 64),
  block_hash text CHECK (block_hash ~ '^0x[0-9a-f]{64}$'),
  block_number numeric(20,0) CHECK (block_number >= 0),
  nonce numeric(20,0) CHECK (nonce >= 0),
  asset text NOT NULL CHECK (asset ~ '^0x[0-9a-f]{40}$'),
  from_address text NOT NULL CHECK (from_address ~ '^0x[0-9a-f]{40}$'),
  to_address text NOT NULL CHECK (to_address ~ '^0x[0-9a-f]{40}$'),
  amount numeric(78,0) NOT NULL CHECK (amount >= 0 AND amount < 115792089237316195423570985008687907853269984665640564039457584007913129639936),
  fee_wei numeric(78,0) CHECK (fee_wei >= 0),
  fee_payer text CHECK (fee_payer ~ '^0x[0-9a-f]{40}$'),
  state text NOT NULL CHECK (state IN ('DRAFT','AWAITING_SIGNATURE','SIGNED','SUBMITTED','INCLUDED','FINALIZED','REVERTED','REPLACED','UNKNOWN','CANCELLED','REORGED')),
  task_id uuid,
  transfer_id text CHECK (transfer_id ~ '^0x[0-9a-f]{64}$'),
  provenance text NOT NULL CHECK (provenance IN ('RPC_VERIFIED','INDEXER_ASSERTION','LOCAL_JOURNAL')),
  observed_at bigint NOT NULL
);
-- One event per chain movement, whichever page or registration found it.
CREATE UNIQUE INDEX activity_events_movement ON activity_events(owner_address, source, tx_hash, COALESCE(log_index, -1), COALESCE(trace_id, ''));
CREATE INDEX activity_events_owner ON activity_events(owner_address, block_number DESC, activity_id);

CREATE TABLE history_coverage (
  owner_address text NOT NULL REFERENCES owner_identities(owner_address),
  source text NOT NULL CHECK (source IN ('PERSONAL','MANAGED')),
  account text NOT NULL CHECK (account ~ '^0x[0-9a-f]{40}$'),
  from_block numeric(20,0) NOT NULL CHECK (from_block >= 0),
  to_block numeric(20,0) NOT NULL CHECK (to_block >= from_block),
  indexed_through numeric(20,0) CHECK (indexed_through >= from_block AND indexed_through <= to_block),
  backfill_state text NOT NULL CHECK (backfill_state IN ('NOT_STARTED','RUNNING','COMPLETE','FAILED')),
  gaps jsonb NOT NULL,
  failure text CHECK (length(failure) <= 200),
  updated_at bigint NOT NULL,
  PRIMARY KEY (owner_address, source),
  CHECK (backfill_state <> 'COMPLETE' OR indexed_through = to_block)
);

CREATE TABLE registered_transactions (
  owner_address text NOT NULL REFERENCES owner_identities(owner_address),
  client_request_id uuid NOT NULL,
  tx_hash text NOT NULL CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  activity_id text NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY (owner_address, client_request_id)
);
