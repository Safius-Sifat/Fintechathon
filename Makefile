PNPM := ./scripts/pnpm.sh
.PHONY: setup doctor infra-up infra-down dev-platform dev-provider dev-mobile dev-worker db-migrate typecheck build check-schema check-contracts check-platform check-mobile check-agents check-integration release-check mpc-fetch
setup:
	$(PNPM) install --frozen-lockfile
	$(PNPM) setup:env
doctor:
	$(PNPM) doctor
infra-up:
	$(PNPM) infra:up
infra-down:
	$(PNPM) infra:down
dev-platform:
	$(PNPM) dev:platform
dev-provider:
	$(PNPM) dev:provider
dev-mobile:
	$(PNPM) dev:mobile
dev-worker:
	$(PNPM) dev:worker
db-migrate:
	$(PNPM) db:migrate
typecheck:
	$(PNPM) typecheck
build:
	$(PNPM) build
check-schema:
	node scripts/check-suite.mjs node @mandate/schema
	node scripts/check-suite.mjs forge packages/contracts test/MandateHashes.t.sol
check-contracts:
	node scripts/check-suite.mjs forge packages/contracts 'test/**/*.t.sol'
	$(PNPM) --filter @mandate/contracts abi:check
check-platform check-mobile check-agents:
	node scripts/not-ready.mjs $@
check-integration:
	$(PNPM) check:integration
release-check:
	$(PNPM) release:check
mpc-fetch:
	$(PNPM) mpc:fetch
