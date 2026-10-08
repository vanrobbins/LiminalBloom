ALTER TABLE "stockroom_bins" DROP CONSTRAINT "stockroom_bins_zone_id_zones_id_fk";
--> statement-breakpoint
ALTER TABLE "stockroom_bins" ADD CONSTRAINT "stockroom_bins_zone_fk" FOREIGN KEY ("store_id","zone_id") REFERENCES "public"."zones"("store_id","id") ON DELETE set null ON UPDATE no action;