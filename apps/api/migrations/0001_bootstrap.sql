-- Foundation metadata only. Business tables/constraints are Person2 deliverables.
CREATE TABLE project_metadata (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO project_metadata(key,value) VALUES
 ('release_spec','{"documentationVersion":"5.0","domainVersion":"4","chainId":84532,"stage":"bootstrap"}');
