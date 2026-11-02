-- Hand-edited after `drizzle-kit generate` (DECISIONS 10-08, 10-12):
-- 1. Columns become half a foot (spec §2). The old checks are dropped first,
--    every column value is doubled, then the new checks are added: doubling a
--    24-column face to 48 would break the old check.
-- 2. The doubling block (double:start … double:end) reads lb.double_store: unset
--    during `drizzle-kit migrate`, so every store doubles; set by
--    lib/db/half-foot-migration.test.ts to scope the same SQL to one test store.
-- 3. Published snapshots (planogram_versions.placements) are rewritten, not
--    tagged with a unit: one coordinate system in code. The migration runs as
--    the owner; app_store_user stays insert-only on versions.
-- 4. Versions are bumped where rows have one, so an editor left open across the
--    migration gets "Changed on another device" instead of writing old values back.
ALTER TABLE "product_categories" DROP CONSTRAINT "product_categories_ranges";--> statement-breakpoint
ALTER TABLE "fixture_faces" DROP CONSTRAINT "fixture_faces_grid_range";--> statement-breakpoint
ALTER TABLE "product_footprints" DROP CONSTRAINT "product_footprints_ranges";--> statement-breakpoint
ALTER TABLE "product_locations" DROP CONSTRAINT "product_locations_ranges";--> statement-breakpoint
ALTER TABLE "planogram_placements" DROP CONSTRAINT "planogram_placements_ranges";--> statement-breakpoint
-- double:start
UPDATE "fixture_faces" SET "grid_columns" = "grid_columns" * 2, "version" = "version" + 1
  WHERE "store_id" = coalesce(nullif(current_setting('lb.double_store', true), ''), "store_id");--> statement-breakpoint
UPDATE "product_categories" SET "hung_columns" = "hung_columns" * 2, "folded_columns" = "folded_columns" * 2, "version" = "version" + 1
  WHERE "store_id" = coalesce(nullif(current_setting('lb.double_store', true), ''), "store_id");--> statement-breakpoint
UPDATE "product_footprints" SET "grid_columns" = "grid_columns" * 2
  WHERE "store_id" = coalesce(nullif(current_setting('lb.double_store', true), ''), "store_id");--> statement-breakpoint
UPDATE "product_locations" SET "col" = "col" * 2, "col_span" = "col_span" * 2
  WHERE "face_id" IS NOT NULL AND "store_id" = coalesce(nullif(current_setting('lb.double_store', true), ''), "store_id");--> statement-breakpoint
UPDATE "planogram_placements" SET "col" = "col" * 2, "col_span" = "col_span" * 2, "version" = "version" + 1
  WHERE "store_id" = coalesce(nullif(current_setting('lb.double_store', true), ''), "store_id");--> statement-breakpoint
UPDATE "planogram_versions" v SET "placements" = (
  SELECT coalesce(
    jsonb_agg(e || jsonb_build_object('col', (e->>'col')::int * 2, 'colSpan', (e->>'colSpan')::int * 2) ORDER BY i),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(v."placements") WITH ORDINALITY AS t(e, i)
) WHERE v."store_id" = coalesce(nullif(current_setting('lb.double_store', true), ''), v."store_id");--> statement-breakpoint
-- double:end
ALTER TABLE "product_categories" ALTER COLUMN "hung_columns" SET DEFAULT 2;--> statement-breakpoint
ALTER TABLE "product_categories" ALTER COLUMN "folded_columns" SET DEFAULT 4;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_ranges" CHECK ("product_categories"."hung_columns" between 1 and 48 and "product_categories"."hung_rows" between 1 and 24 and "product_categories"."folded_columns" between 1 and 48 and "product_categories"."folded_rows" between 1 and 24 and "product_categories"."stack_limit" between 1 and 99);--> statement-breakpoint
ALTER TABLE "fixture_faces" ADD CONSTRAINT "fixture_faces_grid_range" CHECK ("fixture_faces"."grid_columns" between 1 and 48 and "fixture_faces"."grid_rows" between 1 and 24);--> statement-breakpoint
ALTER TABLE "product_footprints" ADD CONSTRAINT "product_footprints_ranges" CHECK ("product_footprints"."grid_columns" between 1 and 48 and "product_footprints"."grid_rows" between 1 and 24 and "product_footprints"."stack_limit" between 1 and 99);--> statement-breakpoint
ALTER TABLE "product_locations" ADD CONSTRAINT "product_locations_ranges" CHECK ("product_locations"."col" between 0 and 47 and "product_locations"."row" between 0 and 23 and "product_locations"."col_span" between 1 and 48 and "product_locations"."row_span" between 1 and 24 and "product_locations"."col" + "product_locations"."col_span" <= 48);--> statement-breakpoint
ALTER TABLE "planogram_placements" ADD CONSTRAINT "planogram_placements_ranges" CHECK ("planogram_placements"."col" between 0 and 47 and "planogram_placements"."row" between 0 and 23 and "planogram_placements"."col_span" between 1 and 48 and "planogram_placements"."row_span" between 1 and 24 and "planogram_placements"."col" + "planogram_placements"."col_span" <= 48 and "planogram_placements"."row" + "planogram_placements"."row_span" <= 24 and "planogram_placements"."piece_count" between 1 and 99);
