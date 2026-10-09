-- Hand-edited after `drizzle-kit generate` (DECISIONS 10-08):
-- 1. The unique (store_id, id) indexes come first: a composite FK needs a unique
--    index on its target columns, and drizzle-kit emits indexes last.
-- 2. ON DELETE SET NULL ("zone_id"): a bare SET NULL on a composite FK nulls
--    store_id too, which is NOT NULL, so deleting a zone would fail (Postgres 15+).
-- 3. DROP ... IF EXISTS: a hand-run script already dropped
--    stockroom_bins_zone_id_zones_id_fk on production (STATUS 10-08).
CREATE UNIQUE INDEX "fixtures_store_id_unique" ON "fixtures" USING btree ("store_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "zones_store_id_unique" ON "zones" USING btree ("store_id","id");--> statement-breakpoint
ALTER TABLE "fixture_faces" DROP CONSTRAINT IF EXISTS "fixture_faces_fixture_id_fixtures_id_fk";--> statement-breakpoint
ALTER TABLE "fixtures" DROP CONSTRAINT IF EXISTS "fixtures_zone_id_zones_id_fk";--> statement-breakpoint
ALTER TABLE "stockroom_bins" DROP CONSTRAINT IF EXISTS "stockroom_bins_zone_id_zones_id_fk";--> statement-breakpoint
ALTER TABLE "fixture_faces" ADD CONSTRAINT "fixture_faces_fixture_fk" FOREIGN KEY ("store_id","fixture_id") REFERENCES "public"."fixtures"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_zone_fk" FOREIGN KEY ("store_id","zone_id") REFERENCES "public"."zones"("store_id","id") ON DELETE set null ("zone_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockroom_bins" ADD CONSTRAINT "stockroom_bins_zone_fk" FOREIGN KEY ("store_id","zone_id") REFERENCES "public"."zones"("store_id","id") ON DELETE set null ("zone_id") ON UPDATE no action;
