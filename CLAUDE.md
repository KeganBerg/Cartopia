# Cartopia

## UI and UX

Read `docs/ui-rules.md` before adding or changing any screen, panel or popup. Short version: show with renders, icons and numbers; at most one short line of text per card; no flavour paragraphs; status as icons; one primary action. `npx vitest run src/uiCopy.test.ts` fails on new walls of text.

## Database migrations

- Create every migration with `supabase migration new <name>` (14-digit timestamp version). Never use `NNNN_` numbering, and never reuse or edit a version that is already live: change things in a new migration.
- Commit the migration file and let it ship through git. Do not apply SQL to production through the SQL editor or the Supabase MCP (`apply_migration` / `execute_sql`): anything run outside `supabase/migrations` leaves the live history out of step with the repo.
- `scripts/check-migration-drift.sql` (read-only) compares live with the repo; `supabase/MIGRATION_RENAME_MAP.md` records the 2026-11 move from `NNNN_` names to timestamps.
