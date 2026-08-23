-- Add reasoning effort level to agents
-- Allows per-agent configuration of inference effort (auto, low, medium, high, xhigh, max)
-- Maps to provider-specific reasoning effort parameters (e.g. Claude's thinking/budget_tokens)

-- IF NOT EXISTS is required, not cosmetic: ensureRuntimeSchema() in
-- server/index.cjs adds this same column at boot (AGENSIS_RUNTIME_SCHEMA is not
-- 'false' in production), so by the time `npm run migrate` reaches this file the
-- column already exists. A bare ADD COLUMN would abort the transaction with
-- "column effort of relation workspace_agents already exists", roll back, and
-- block every LATER migration behind it. Every other migration here is written
-- the same way for the same reason.
ALTER TABLE workspace_agents
  ADD COLUMN IF NOT EXISTS effort text NOT NULL DEFAULT 'auto'
  CHECK (effort IN ('auto', 'low', 'medium', 'high', 'xhigh', 'max'));

-- ADD COLUMN IF NOT EXISTS skips the inline CHECK when the column is already
-- there, so add it separately and idempotently.
DO $$
BEGIN
  ALTER TABLE workspace_agents
    ADD CONSTRAINT workspace_agents_effort_check
    CHECK (effort IN ('auto', 'low', 'medium', 'high', 'xhigh', 'max'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Index for querying agents by effort level (useful for reporting/filtering)
CREATE INDEX IF NOT EXISTS idx_workspace_agents_effort ON workspace_agents(effort);
