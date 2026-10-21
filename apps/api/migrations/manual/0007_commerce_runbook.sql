-- Reviewed manual migration (plan 05): Mandate Test Shop orders are tasks of
-- the commerce-buy runbook. Widening a CHECK is outside the automatic
-- expansion policy, so an operator runs this once, after a backup and before
-- deploying a backend that creates commerce-buy tasks. It only widens the
-- allowed values; existing rows and older backends are unaffected.
--
--   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f 0007_commerce_runbook.sql
ALTER TABLE tasks DROP CONSTRAINT tasks_runbook_id_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_runbook_id_check CHECK (runbook_id IN ('browser-check','liquidity-keeper','scheduled-pay','service-allowance','commerce-buy'));
