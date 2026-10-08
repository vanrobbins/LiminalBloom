-- Hand-edited (spec §4): trigram search needs the extension before its indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."presentation" AS ENUM('hung', 'folded');--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"name" text NOT NULL,
	"hung_columns" integer DEFAULT 1 NOT NULL,
	"hung_rows" integer DEFAULT 3 NOT NULL,
	"folded_columns" integer DEFAULT 2 NOT NULL,
	"folded_rows" integer DEFAULT 2 NOT NULL,
	"stack_limit" integer DEFAULT 8 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_categories_ranges" CHECK ("product_categories"."hung_columns" between 1 and 24 and "product_categories"."hung_rows" between 1 and 24 and "product_categories"."folded_columns" between 1 and 24 and "product_categories"."folded_rows" between 1 and 24 and "product_categories"."stack_limit" between 1 and 99)
);
--> statement-breakpoint
CREATE TABLE "product_footprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"presentation" "presentation" NOT NULL,
	"grid_columns" integer NOT NULL,
	"grid_rows" integer NOT NULL,
	"stack_limit" integer NOT NULL,
	CONSTRAINT "product_footprints_ranges" CHECK ("product_footprints"."grid_columns" between 1 and 24 and "product_footprints"."grid_rows" between 1 and 24 and "product_footprints"."stack_limit" between 1 and 99)
);
--> statement-breakpoint
CREATE TABLE "product_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"presentation" "presentation" NOT NULL,
	"face_id" uuid,
	"col" integer,
	"row" integer,
	"col_span" integer,
	"row_span" integer,
	"bin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_locations_shape" CHECK (("product_locations"."bin_id" is null and "product_locations"."face_id" is not null and "product_locations"."col" is not null and "product_locations"."row" is not null and "product_locations"."col_span" is not null and "product_locations"."row_span" is not null)
        or ("product_locations"."bin_id" is not null and "product_locations"."face_id" is null and "product_locations"."col" is null and "product_locations"."row" is null and "product_locations"."col_span" is null and "product_locations"."row_span" is null)),
	CONSTRAINT "product_locations_ranges" CHECK ("product_locations"."col" between 0 and 23 and "product_locations"."row" between 0 and 23 and "product_locations"."col_span" between 1 and 24 and "product_locations"."row_span" between 1 and 24 and "product_locations"."col" + "product_locations"."col_span" <= 24 and "product_locations"."row" + "product_locations"."row_span" <= 24)
);
--> statement-breakpoint
CREATE TABLE "stockroom_bins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"code" text NOT NULL,
	"zone_id" uuid
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "size_range" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_path" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "search_text" text GENERATED ALWAYS AS (lower(name || ' ' || style_number || ' ' || color)) STORED;--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_store_id_unique" ON "product_categories" USING btree ("store_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_id_unique" ON "products" USING btree ("store_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "fixture_faces_store_id_unique" ON "fixture_faces" USING btree ("store_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "stockroom_bins_store_id_unique" ON "stockroom_bins" USING btree ("store_id","id");--> statement-breakpoint
-- Hand-edited: one category per distinct name a store already uses, then point
-- each product at it. Case variants ("Denim"/"denim") share one category.
INSERT INTO "product_categories" ("store_id", "name")
  SELECT DISTINCT ON ("store_id", lower("category")) "store_id", "category" FROM "products"
  ORDER BY "store_id", lower("category"), "category";--> statement-breakpoint
UPDATE "products" p SET "category_id" = c."id"
  FROM "product_categories" c
  WHERE c."store_id" = p."store_id" AND lower(c."name") = lower(p."category");--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "category_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_footprints" ADD CONSTRAINT "product_footprints_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_footprints" ADD CONSTRAINT "product_footprints_product_fk" FOREIGN KEY ("store_id","product_id") REFERENCES "public"."products"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_locations" ADD CONSTRAINT "product_locations_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_locations" ADD CONSTRAINT "product_locations_product_fk" FOREIGN KEY ("store_id","product_id") REFERENCES "public"."products"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_locations" ADD CONSTRAINT "product_locations_face_fk" FOREIGN KEY ("store_id","face_id") REFERENCES "public"."fixture_faces"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_locations" ADD CONSTRAINT "product_locations_bin_fk" FOREIGN KEY ("store_id","bin_id") REFERENCES "public"."stockroom_bins"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockroom_bins" ADD CONSTRAINT "stockroom_bins_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockroom_bins" ADD CONSTRAINT "stockroom_bins_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_name_unique" ON "product_categories" USING btree ("store_id",lower("name"));--> statement-breakpoint
CREATE INDEX "product_categories_name_trgm" ON "product_categories" USING gin (lower("name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "product_footprints_store_idx" ON "product_footprints" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_footprints_unique" ON "product_footprints" USING btree ("product_id","presentation");--> statement-breakpoint
CREATE INDEX "product_locations_store_idx" ON "product_locations" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "product_locations_product_idx" ON "product_locations" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stockroom_bins_code_unique" ON "stockroom_bins" USING btree ("store_id",lower("code"));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_fk" FOREIGN KEY ("store_id","category_id") REFERENCES "public"."product_categories"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "products_style_unique" ON "products" USING btree ("store_id",lower("style_number"));--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_search_trgm" ON "products" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
-- Hand-edited (spec §4.8): the store-map policy, extended to the product library.
GRANT SELECT, INSERT, UPDATE, DELETE ON "products", "product_categories", "product_footprints", "stockroom_bins", "product_locations" TO app_store_user;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_footprints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stockroom_bins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "store_isolation" ON "products" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
CREATE POLICY "store_isolation" ON "product_categories" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
CREATE POLICY "store_isolation" ON "product_footprints" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
CREATE POLICY "store_isolation" ON "stockroom_bins" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
CREATE POLICY "store_isolation" ON "product_locations" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));
