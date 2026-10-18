CREATE TABLE owner_identities (
  owner_address text PRIMARY KEY CHECK (owner_address ~ '^0x[0-9a-f]{40}$'),
  created_at bigint NOT NULL CHECK (created_at >= 0)
);
CREATE TABLE auth_rate_limits (
  bucket text NOT NULL,
  window_start bigint NOT NULL,
  requests integer NOT NULL CHECK (requests > 0),
  PRIMARY KEY (bucket, window_start)
);
CREATE TABLE auth_challenges (
  id uuid PRIMARY KEY,
  owner_address text NOT NULL CHECK (owner_address ~ '^0x[0-9a-f]{40}$'),
  device_id text NOT NULL CHECK (device_id ~ '^0x[0-9a-f]{64}$'),
  nonce text NOT NULL UNIQUE CHECK (nonce ~ '^0x[0-9a-f]{64}$'),
  typed_data jsonb NOT NULL,
  issued_at bigint NOT NULL CHECK (issued_at >= 0),
  expires_at bigint NOT NULL,
  consumed_at bigint,
  CHECK (expires_at > issued_at AND expires_at <= issued_at + 300),
  CHECK (consumed_at IS NULL OR consumed_at >= issued_at)
);
CREATE INDEX auth_challenges_expiry ON auth_challenges(expires_at);
CREATE TABLE owner_sessions (
  id uuid PRIMARY KEY,
  owner_address text NOT NULL REFERENCES owner_identities(owner_address),
  device_id text NOT NULL CHECK (device_id ~ '^0x[0-9a-f]{64}$'),
  device_label text NOT NULL DEFAULT '' CHECK (length(device_label) <= 64),
  auth_time bigint NOT NULL CHECK (auth_time >= 0),
  created_at bigint NOT NULL,
  last_used_at bigint NOT NULL,
  idle_expires_at bigint NOT NULL,
  absolute_expires_at bigint NOT NULL,
  revoked_at bigint,
  CHECK (created_at = auth_time AND last_used_at >= created_at),
  CHECK (absolute_expires_at = created_at + 2592000),
  CHECK (idle_expires_at <= absolute_expires_at AND idle_expires_at > created_at),
  CHECK (idle_expires_at <= last_used_at + 604800),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX owner_sessions_owner ON owner_sessions(owner_address, created_at);
CREATE TABLE refresh_token_families (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL UNIQUE REFERENCES owner_sessions(id),
  revoked_at bigint
);
CREATE TABLE refresh_tokens (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  family_id uuid NOT NULL REFERENCES refresh_token_families(id),
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL CHECK (expires_at > created_at),
  replaced_at bigint
);
CREATE INDEX refresh_tokens_family ON refresh_tokens(family_id);
CREATE UNIQUE INDEX refresh_tokens_one_current ON refresh_tokens(family_id) WHERE replaced_at IS NULL;
CREATE TABLE auth_idempotency (
  owner_address text NOT NULL REFERENCES owner_identities(owner_address),
  route text NOT NULL CHECK (route IN ('/v1/auth/logout', '/v1/auth/sessions/revoke')),
  key uuid NOT NULL,
  body_hash text NOT NULL CHECK (body_hash ~ '^[0-9a-f]{64}$'),
  response jsonb NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY (owner_address, route, key)
);
