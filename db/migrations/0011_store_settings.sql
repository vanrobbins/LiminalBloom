-- Hand-edited after `drizzle-kit generate` (DECISIONS 10-08, "Time" 10-12):
-- every existing store gets Pacific; grants and row-level security added by
-- hand, as in 0005/0006/0009.
CREATE TABLE "store_settings" (
	"store_id" text PRIMARY KEY NOT NULL,
	"timezone" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "store_settings" ("store_id", "timezone") SELECT "id", 'America/Los_Angeles' FROM "organization";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "store_settings" TO app_store_user;--> statement-breakpoint
ALTER TABLE "store_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "store_isolation" ON "store_settings" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));
