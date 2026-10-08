ALTER TABLE "fixtures" DROP CONSTRAINT "fixtures_table_set_fk";
--> statement-breakpoint
ALTER TABLE "table_sets" DROP CONSTRAINT "table_sets_fixture_fk";
--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_table_set_id_table_sets_id_fk" FOREIGN KEY ("table_set_id") REFERENCES "public"."table_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sets" ADD CONSTRAINT "table_sets_upper_fixture_id_fixtures_id_fk" FOREIGN KEY ("upper_fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;