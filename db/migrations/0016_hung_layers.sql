ALTER TABLE "planogram_placements" ADD COLUMN "depth" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_locations" ADD COLUMN "depth" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "planogram_placements" ADD CONSTRAINT "planogram_placements_depth" CHECK ("planogram_placements"."depth" between 0 and 98);--> statement-breakpoint
ALTER TABLE "product_locations" ADD CONSTRAINT "product_locations_depth" CHECK ("product_locations"."depth" between 0 and 98);