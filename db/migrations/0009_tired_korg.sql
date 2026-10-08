ALTER TABLE "fixture_faces" DROP CONSTRAINT "fixture_faces_fixture_id_fixtures_id_fk";
--> statement-breakpoint
ALTER TABLE "fixtures" DROP CONSTRAINT "fixtures_zone_id_zones_id_fk";
--> statement-breakpoint
ALTER TABLE "fixtures" DROP CONSTRAINT "fixtures_table_set_id_table_sets_id_fk";
--> statement-breakpoint
ALTER TABLE "table_sets" DROP CONSTRAINT "table_sets_upper_fixture_id_fixtures_id_fk";
--> statement-breakpoint
ALTER TABLE "fixture_faces" ADD CONSTRAINT "fixture_faces_fixture_fk" FOREIGN KEY ("store_id","fixture_id") REFERENCES "public"."fixtures"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_zone_fk" FOREIGN KEY ("store_id","zone_id") REFERENCES "public"."zones"("store_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_table_set_fk" FOREIGN KEY ("store_id","table_set_id") REFERENCES "public"."table_sets"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sets" ADD CONSTRAINT "table_sets_fixture_fk" FOREIGN KEY ("store_id","upper_fixture_id") REFERENCES "public"."fixtures"("store_id","id") ON DELETE cascade ON UPDATE no action;