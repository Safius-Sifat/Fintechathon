# Infrastructure boundary

`compose.dev.yaml` starts local Postgres, authenticated NATS/JetStream and ephemeral Consul discovery. Ports bind127.0.0.1. Consul dev mode has no production ACL/TLS configuration and is never a release deployment. NATS credentials are local only. Preserve Postgres/NATS named volumes; `infra:down` does not delete them.

MPC nodes are intentionally not configured with example passwords/keys or auto-started. Person2 must implement the pinned two-node setup, mandatory nonempty authorizer configuration and separate protected identities/storage described in their handoff. `pnpm mpc:fetch` fetches source only. Source download does not establish MPC readiness.

Release needs host A/execution and host B/policy with separately controlled share/password/backup credentials, authenticated encrypted private transport, infrastructure ACLs and independent RPC. Pin release images by verified digests in the deployment manifest. Development images are pinned to registry manifest digests resolved during bootstrap; this metadata is not runtime or release qualification.
