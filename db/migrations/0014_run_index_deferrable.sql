-- Hand-edited after `drizzle-kit generate` (DECISIONS 10-08): the run index
-- is unique per run, checked at commit (DEFERRABLE INITIALLY DEFERRED), because
-- a map save that re-indexes a run (a rack leaves, the anchor changes) passes
-- through duplicates between its statements. drizzle-kit can't write DEFERRABLE.
DROP INDEX "fixtures_run_index_unique";--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_run_index_unique" UNIQUE("run_id","run_index") DEFERRABLE INITIALLY DEFERRED;
