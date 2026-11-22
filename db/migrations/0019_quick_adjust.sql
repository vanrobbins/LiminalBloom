-- Hand-edited after `drizzle-kit generate` (as 0009):
-- 1. "planogram_adjustments_store_id_unique" moved before the foreign keys: the changes'
--    composite FK to the adjustment needs a unique index on its target, and drizzle-kit
--    emits indexes last.
-- 2. Grants and row-level security added by hand at the end (spec §6.1): both tables are
--    SELECT, INSERT, UPDATE, DELETE for app_store_user, with the store_isolation policy.
CREATE TYPE "public"."adjustment_change" AS ENUM('replace', 'empty');--> statement-breakpoint
CREATE TYPE "public"."adjustment_state" AS ENUM('draft', 'published', 'ended');--> statement-breakpoint
CREATE TABLE "planogram_adjustment_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"adjustment_id" uuid NOT NULL,
	"kind" "adjustment_change" NOT NULL,
	"face_id" uuid NOT NULL,
	"target_product_id" uuid NOT NULL,
	"presentation" "presentation" NOT NULL,
	"col" integer NOT NULL,
	"row" integer NOT NULL,
	"col_span" integer NOT NULL,
	"row_span" integer NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"replacement_product_id" uuid,
	"replacement_col_span" integer,
	"replacement_row_span" integer,
	"piece_count" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planogram_adjustment_changes_ranges" CHECK ("planogram_adjustment_changes"."col" between 0 and 47 and "planogram_adjustment_changes"."row" between 0 and 23 and "planogram_adjustment_changes"."col_span" between 1 and 48 and "planogram_adjustment_changes"."row_span" between 1 and 24 and "planogram_adjustment_changes"."col" + "planogram_adjustment_changes"."col_span" <= 48 and "planogram_adjustment_changes"."row" + "planogram_adjustment_changes"."row_span" <= 24 and "planogram_adjustment_changes"."piece_count" between 1 and 99 and "planogram_adjustment_changes"."replacement_col_span" between 1 and 48 and "planogram_adjustment_changes"."replacement_row_span" between 1 and 24),
	CONSTRAINT "planogram_adjustment_changes_depth" CHECK ("planogram_adjustment_changes"."depth" between 0 and 98),
	CONSTRAINT "planogram_adjustment_changes_replacement" CHECK (("planogram_adjustment_changes"."kind" = 'replace' and "planogram_adjustment_changes"."replacement_product_id" is not null and "planogram_adjustment_changes"."replacement_col_span" is not null and "planogram_adjustment_changes"."replacement_row_span" is not null) or ("planogram_adjustment_changes"."kind" = 'empty' and "planogram_adjustment_changes"."replacement_product_id" is null and "planogram_adjustment_changes"."replacement_col_span" is null and "planogram_adjustment_changes"."replacement_row_span" is null))
);
--> statement-breakpoint
CREATE TABLE "planogram_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"planogram_id" uuid NOT NULL,
	"based_on_version" integer NOT NULL,
	"state" "adjustment_state" DEFAULT 'draft' NOT NULL,
	"ended_reason" text,
	"created_by_name" text NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" text,
	"published_by_name" text,
	"ended_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planogram_adjustments_based_on" CHECK ("planogram_adjustments"."based_on_version" >= 1),
	CONSTRAINT "planogram_adjustments_ended_reason" CHECK (("planogram_adjustments"."ended_reason" is not null) = ("planogram_adjustments"."state" = 'ended')),
	CONSTRAINT "planogram_adjustments_ended_reason_known" CHECK ("planogram_adjustments"."ended_reason" in ('reverted', 'superseded', 'new_version'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "planogram_adjustments_store_id_unique" ON "planogram_adjustments" USING btree ("store_id","id");--> statement-breakpoint
ALTER TABLE "planogram_adjustment_changes" ADD CONSTRAINT "planogram_adjustment_changes_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planogram_adjustment_changes" ADD CONSTRAINT "planogram_adjustment_changes_adjustment_fk" FOREIGN KEY ("store_id","adjustment_id") REFERENCES "public"."planogram_adjustments"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planogram_adjustment_changes" ADD CONSTRAINT "planogram_adjustment_changes_face_fk" FOREIGN KEY ("store_id","face_id") REFERENCES "public"."fixture_faces"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planogram_adjustment_changes" ADD CONSTRAINT "planogram_adjustment_changes_target_fk" FOREIGN KEY ("store_id","target_product_id") REFERENCES "public"."products"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planogram_adjustment_changes" ADD CONSTRAINT "planogram_adjustment_changes_replacement_fk" FOREIGN KEY ("store_id","replacement_product_id") REFERENCES "public"."products"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planogram_adjustments" ADD CONSTRAINT "planogram_adjustments_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planogram_adjustments" ADD CONSTRAINT "planogram_adjustments_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planogram_adjustments" ADD CONSTRAINT "planogram_adjustments_planogram_fk" FOREIGN KEY ("store_id","planogram_id") REFERENCES "public"."planograms"("store_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planogram_adjustment_changes_store_idx" ON "planogram_adjustment_changes" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planogram_adjustment_changes_target_unique" ON "planogram_adjustment_changes" USING btree ("adjustment_id","face_id","col","row","depth","target_product_id");--> statement-breakpoint
CREATE INDEX "planogram_adjustments_store_idx" ON "planogram_adjustments" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "planogram_adjustments_planogram_idx" ON "planogram_adjustments" USING btree ("planogram_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planogram_adjustments_one_draft" ON "planogram_adjustments" USING btree ("planogram_id") WHERE "planogram_adjustments"."state" = 'draft';--> statement-breakpoint
CREATE UNIQUE INDEX "planogram_adjustments_one_published" ON "planogram_adjustments" USING btree ("planogram_id") WHERE "planogram_adjustments"."state" = 'published';--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "planogram_adjustments", "planogram_adjustment_changes" TO app_store_user;--> statement-breakpoint
ALTER TABLE "planogram_adjustments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "planogram_adjustment_changes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "store_isolation" ON "planogram_adjustments" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
CREATE POLICY "store_isolation" ON "planogram_adjustment_changes" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));
