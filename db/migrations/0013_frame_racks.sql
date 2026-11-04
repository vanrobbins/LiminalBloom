-- Hand-edited after `drizzle-kit generate` (DECISIONS 10-08), frame racks spec §4.1:
-- the run FK nulls run_id only (a bare SET NULL on a composite FK would null
-- store_id too, as in 0008); grants and row-level security on frame_runs added
-- by hand, as for table_sets in 0005. The frame_rack check compares type::text,
-- because a new enum value can't be used in the transaction that adds it.
ALTER TYPE "public"."fixture_type" ADD VALUE 'frame_rack';--> statement-breakpoint
CREATE TABLE "frame_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"start_index" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "frame_runs_start_range" CHECK ("frame_runs"."start_index" between 0 and 5)
);
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "run_index" integer;--> statement-breakpoint
ALTER TABLE "frame_runs" ADD CONSTRAINT "frame_runs_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "frame_runs_store_idx" ON "frame_runs" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "frame_runs_store_id_unique" ON "frame_runs" USING btree ("store_id","id");--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_run_fk" FOREIGN KEY ("store_id","run_id") REFERENCES "public"."frame_runs"("store_id","id") ON DELETE set null ("run_id") ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fixtures_run_index_unique" ON "fixtures" USING btree ("run_id","run_index");--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_run_index_range" CHECK ("fixtures"."run_index" between 0 and 5);--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_run_has_index" CHECK ("fixtures"."run_id" is null or "fixtures"."run_index" is not null);--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_run_frame_rack" CHECK ("fixtures"."run_id" is null or "fixtures"."type"::text = 'frame_rack');--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "frame_runs" TO app_store_user;--> statement-breakpoint
ALTER TABLE "frame_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "store_isolation" ON "frame_runs" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));
