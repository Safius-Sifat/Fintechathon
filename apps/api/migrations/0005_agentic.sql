-- v7 agentic layer and owner controls (P2-A01/A02/A03).
CREATE TABLE agent_questions (
  question_id uuid PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES tasks(id),
  question jsonb NOT NULL,
  permit_id text CHECK (permit_id ~ '^0x[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('OPEN','ANSWERED','DEFAULTED','FAILED')),
  answer jsonb,
  answer_hash text CHECK (answer_hash ~ '^[0-9a-f]{64}$'),
  decision_id uuid UNIQUE,
  agent_token_id uuid REFERENCES agent_tokens(id),
  deadline bigint NOT NULL,
  created_at bigint NOT NULL,
  answered_at bigint,
  CHECK ((state = 'OPEN') = (decision_id IS NULL))
);
CREATE UNIQUE INDEX agent_questions_one_open ON agent_questions(task_id) WHERE state = 'OPEN';

CREATE TABLE intent_drafts (
  intent_id uuid PRIMARY KEY,
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  goal text NOT NULL CHECK (length(goal) BETWEEN 1 AND 2000),
  draft jsonb NOT NULL,
  created_at bigint NOT NULL
);

CREATE TABLE approval_requests (
  approval_id uuid PRIMARY KEY,
  action_id uuid NOT NULL UNIQUE REFERENCES actions(id),
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  action_digest text NOT NULL CHECK (action_digest ~ '^0x[0-9a-f]{64}$'),
  expires_at bigint NOT NULL,
  state text NOT NULL CHECK (state IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
  owner_signature text CHECK (owner_signature ~ '^0x[0-9a-f]{130}$'),
  rationale text CHECK (length(rationale) <= 2000),
  created_at bigint NOT NULL,
  decided_at bigint,
  CHECK ((state = 'APPROVED') = (owner_signature IS NOT NULL))
);

-- Owner-signed WalletPolicy and Admin commands, relayed on the emergency lane.
CREATE TABLE owner_commands (
  draft_id uuid PRIMARY KEY,
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  kind text NOT NULL CHECK (kind IN ('POLICY','ADMIN')),
  message jsonb NOT NULL,
  lists jsonb,
  typed_data jsonb NOT NULL,
  digest text NOT NULL UNIQUE CHECK (digest ~ '^0x[0-9a-f]{64}$'),
  owner_signature text CHECK (owner_signature ~ '^0x[0-9a-f]{130}$'),
  state text NOT NULL CHECK (state IN ('DRAFT','SUBMITTED','INCLUDED','REVERTED')),
  tx_id uuid REFERENCES transactions(id),
  expires_at bigint NOT NULL,
  created_at bigint NOT NULL,
  CHECK ((state = 'DRAFT') = (owner_signature IS NULL))
);
-- Confirmed on-chain WalletPolicy versions, recorded only from WalletPolicyUpdated.
CREATE TABLE wallet_policies (
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  version numeric(20,0) NOT NULL CHECK (version >= 1),
  policy jsonb NOT NULL,
  lists jsonb NOT NULL,
  tx_hash text NOT NULL CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  created_at bigint NOT NULL,
  PRIMARY KEY (wallet_id, version)
);

CREATE TABLE push_devices (
  owner_address text NOT NULL REFERENCES owner_identities(owner_address),
  device_id text NOT NULL CHECK (device_id ~ '^0x[0-9a-f]{64}$'),
  session_id uuid NOT NULL REFERENCES owner_sessions(id),
  platform text NOT NULL CHECK (platform IN ('android','ios')),
  push_token text NOT NULL CHECK (length(push_token) BETWEEN 16 AND 4096),
  created_at bigint NOT NULL,
  PRIMARY KEY (owner_address, device_id)
);
CREATE TABLE push_deliveries (
  id uuid PRIMARY KEY,
  owner_address text NOT NULL REFERENCES owner_identities(owner_address),
  kind text NOT NULL CHECK (kind IN ('APPROVAL','ALERT')),
  reference_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('SENT','UNSUPPORTED','FAILED','NO_DEVICE')),
  created_at bigint NOT NULL,
  UNIQUE (owner_address, kind, reference_id)
);

-- Runbook preparation from @mandate/runbooks prepareTask, stored with the task.
ALTER TABLE tasks ADD COLUMN conditions jsonb;
ALTER TABLE tasks ADD COLUMN scope jsonb;
ALTER TABLE tasks ADD COLUMN needs_owner_reason text;
