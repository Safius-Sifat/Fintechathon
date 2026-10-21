-- Agent conversations (plan 05): the owner's chats with the agent, their
-- ordered events (messages, product cards, steps, purchase requests), and the
-- tasks each chat started. Deleting a chat only hides it; tasks, payments and
-- evidence are never removed with it.
CREATE TABLE conversations (
  id uuid PRIMARY KEY,
  owner_address text NOT NULL CHECK (owner_address ~ '^0x[0-9a-f]{40}$') REFERENCES owner_identities(owner_address),
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  title text CHECK (length(title) BETWEEN 1 AND 80),
  pinned boolean NOT NULL DEFAULT false,
  hidden_at bigint,
  agent_token_id uuid REFERENCES agent_tokens(id),
  replying boolean NOT NULL DEFAULT false,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX conversations_owner_recent ON conversations(owner_address, updated_at DESC) WHERE hidden_at IS NULL;

CREATE TABLE conversation_events (
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  seq bigint NOT NULL,
  type text NOT NULL CHECK (type IN ('user','agent','products','question','purchase','step','error')),
  payload jsonb NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY (conversation_id, seq)
);

CREATE TABLE conversation_tasks (
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  task_id uuid NOT NULL UNIQUE REFERENCES tasks(id),
  created_at bigint NOT NULL,
  PRIMARY KEY (conversation_id, task_id)
);
