-- Hand-edited after `drizzle-kit generate` (DECISIONS 10-08):
-- 1. "planograms_store_id_unique" moved before the foreign keys: the placements'
--    and versions' composite FKs need a unique index on their target, and
--    drizzle-kit emits indexes last.
-- 2. Grants and row-level security added by hand at the end (spec §3.2), as in
--    0005/0006. planogram_versions is insert-only for app_store_user.
CREATE TABLE "planogram_placements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"planogram_id" uuid NOT NULL,
	"face_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"presentation" "presentation" NOT NULL,
	"col" integer NOT NULL,
	"row" integer NOT NULL,
	"col_span" integer NOT NULL,
	"row_span" integer NOT NULL,
	"piece_count" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planogram_placements_ranges" CHECK ("planogram_placements"."col" between 0 and 23 and "planogram_placements"."row" between 0 and 23 and "planogram_placements"."col_span" between 1 and 24 and "planogram_placements"."row_span" between 1 and 24 and "planogram_placements"."col" + "planogram_placements"."col_span" <= 24 and "planogram_placements"."row" + "planogram_placements"."row_span" <= 24 and "planogram_placements"."piece_count" between 1 and 99)
);
--> statement-breakpoint
CREATE TABLE "planogram_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"planogram_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" text,
	"published_by_name" text NOT NULL,
	"summary" text,
	"placements" jsonb NOT NULL,
	CONSTRAINT "planogram_versions_number_positive" CHECK ("planogram_versions"."number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "planograms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"fixture_id" uuid NOT NULL,
	"based_on_version" integer,
	"published_version" integer,
	"has_draft" boolean DEFAULT false NOT NULL,
	"due_date" date,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "planograms_store_id_unique" ON "planograms" USING btree ("store_id","id");--> statement-breakpoint
ALTER TABLE "planogram_placements" ADD CONSTRAINT "planogram_placements_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planogram_placements" ADD CONSTRAINT "planogram_placements_planogram_fk" FOREIGN KEY ("store_id","planogram_id") REFERENCES "public"."planograms"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planogram_placements" ADD CONSTRAINT "planogram_placements_face_fk" FOREIGN KEY ("store_id","face_id") REFERENCES "public"."fixture_faces"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planogram_placements" ADD CONSTRAINT "planogram_placements_product_fk" FOREIGN KEY ("store_id","product_id") REFERENCES "public"."products"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planogram_versions" ADD CONSTRAINT "planogram_versions_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planogram_versions" ADD CONSTRAINT "planogram_versions_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planogram_versions" ADD CONSTRAINT "planogram_versions_planogram_fk" FOREIGN KEY ("store_id","planogram_id") REFERENCES "public"."planograms"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planograms" ADD CONSTRAINT "planograms_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planograms" ADD CONSTRAINT "planograms_fixture_fk" FOREIGN KEY ("store_id","fixture_id") REFERENCES "public"."fixtures"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planogram_placements_store_idx" ON "planogram_placements" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "planogram_placements_planogram_idx" ON "planogram_placements" USING btree ("planogram_id");--> statement-breakpoint
CREATE INDEX "planogram_versions_store_idx" ON "planogram_versions" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planogram_versions_number_unique" ON "planogram_versions" USING btree ("planogram_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "planograms_fixture_unique" ON "planograms" USING btree ("fixture_id");--> statement-breakpoint
CREATE INDEX "planograms_store_idx" ON "planograms" USING btree ("store_id");--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "planograms", "planogram_placements" TO app_store_user;--> statement-breakpoint
GRANT SELECT, INSERT ON "planogram_versions" TO app_store_user;--> statement-breakpoint
ALTER TABLE "planograms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "planogram_placements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "planogram_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "store_isolation" ON "planograms" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
CREATE POLICY "store_isolation" ON "planogram_placements" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
CREATE POLICY "store_isolation" ON "planogram_versions" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));
