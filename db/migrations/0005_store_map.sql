CREATE TYPE "public"."face_side" AS ENUM('front', 'back', 'left', 'right', 'top');--> statement-breakpoint
CREATE TYPE "public"."fixture_type" AS ENUM('table', 'wall_bay', 'rack', 'mannequin', 'platform', 'prop');--> statement-breakpoint
CREATE TYPE "public"."table_side" AS ENUM('front', 'back', 'left', 'right');--> statement-breakpoint
CREATE TYPE "public"."zone_color" AS ENUM('zone-1', 'zone-2', 'zone-3', 'zone-4', 'zone-5', 'zone-6', 'zone-7', 'zone-8');--> statement-breakpoint
CREATE TYPE "public"."zone_type" AS ENUM('display', 'fitting_room', 'cash_wrap', 'stockroom', 'other');--> statement-breakpoint
CREATE TABLE "entrances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"width" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entrances_width_range" CHECK ("entrances"."width" between 36 and 240)
);
--> statement-breakpoint
CREATE TABLE "fixture_faces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"fixture_id" uuid NOT NULL,
	"side" "face_side" NOT NULL,
	"grid_columns" integer NOT NULL,
	"grid_rows" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fixture_faces_grid_range" CHECK ("fixture_faces"."grid_columns" between 1 and 24 and "fixture_faces"."grid_rows" between 1 and 24)
);
--> statement-breakpoint
CREATE TABLE "fixtures" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"zone_id" uuid,
	"type" "fixture_type" NOT NULL,
	"name" text NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"width" integer NOT NULL,
	"depth" integer NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL,
	"table_set_id" uuid,
	"set_side" "table_side",
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fixtures_rotation_range" CHECK ("fixtures"."rotation" between 0 and 359),
	CONSTRAINT "fixtures_size_range" CHECK ("fixtures"."width" between 12 and 600 and "fixtures"."depth" between 12 and 600)
);
--> statement-breakpoint
CREATE TABLE "store_layouts" (
	"store_id" text PRIMARY KEY NOT NULL,
	"outline" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"upper_fixture_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_sets_upper_fixture_id_unique" UNIQUE("upper_fixture_id")
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "zone_type" NOT NULL,
	"color" "zone_color" NOT NULL,
	"points" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entrances" ADD CONSTRAINT "entrances_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixture_faces" ADD CONSTRAINT "fixture_faces_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixture_faces" ADD CONSTRAINT "fixture_faces_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_table_set_id_table_sets_id_fk" FOREIGN KEY ("table_set_id") REFERENCES "public"."table_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_layouts" ADD CONSTRAINT "store_layouts_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sets" ADD CONSTRAINT "table_sets_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sets" ADD CONSTRAINT "table_sets_upper_fixture_id_fixtures_id_fk" FOREIGN KEY ("upper_fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entrances_store_idx" ON "entrances" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "fixture_faces_store_idx" ON "fixture_faces" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fixture_faces_side_unique" ON "fixture_faces" USING btree ("fixture_id","side");--> statement-breakpoint
CREATE INDEX "fixtures_store_idx" ON "fixtures" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "table_sets_store_idx" ON "table_sets" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "zones_store_idx" ON "zones" USING btree ("store_id");--> statement-breakpoint
-- Hand-written (spec §8): row-level security for the store map. The app connects
-- as the database owner, which RLS ignores, so every map query switches to this
-- role for its transaction (lib/db/with-store.ts) and these policies apply.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_store_user') THEN
    CREATE ROLE app_store_user NOLOGIN;
  END IF;
END $$;--> statement-breakpoint
GRANT app_store_user TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_store_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "store_layouts", "entrances", "zones", "fixtures", "fixture_faces", "table_sets" TO app_store_user;--> statement-breakpoint
ALTER TABLE "store_layouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entrances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "zones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fixtures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fixture_faces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "table_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Fail closed: with no store set, current_setting(..., true) is empty and matches nothing.
CREATE POLICY "store_isolation" ON "store_layouts" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
CREATE POLICY "store_isolation" ON "entrances" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
CREATE POLICY "store_isolation" ON "zones" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
CREATE POLICY "store_isolation" ON "fixtures" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
CREATE POLICY "store_isolation" ON "fixture_faces" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
CREATE POLICY "store_isolation" ON "table_sets" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
-- A guarded write that matched nothing means another save got there first.
-- Raising aborts the whole batch, so a save is never half applied.
CREATE OR REPLACE FUNCTION layout_assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT ok THEN
    RAISE EXCEPTION 'layout_conflict:%', label;
  END IF;
END $$;
