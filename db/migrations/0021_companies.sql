-- A lock held by a running request fails this migration after 5 seconds rather than queueing every request behind it. SET LOCAL lasts to the end of drizzle's one transaction.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
-- Hand-edited after `drizzle-kit generate` (DECISIONS 10-08, "0.7.1", as 0008 and 0013). Tables,
-- columns, enums, indexes, checks and foreign keys are as generated, and so is the snapshot.
-- That includes Better Auth's own addition (session.active_store_id: db/auth-schema.ts,
-- regenerated with lib/auth.ts). Changed or written by hand, because drizzle-kit cannot
-- express them and does not track them:
--   * store_profiles_region_fk is ON DELETE SET NULL ("region_id"): a bare SET NULL on the
--     composite key would also null company_id, which is NOT NULL. The column list needs
--     PostgreSQL 15 or later. The other two region keys stay NO ACTION: a region a regional
--     manager holds, or an invitation names, cannot be deleted.
--   * company_events is insert-only: a trigger refuses UPDATE, DELETE and TRUNCATE (the owner
--     connection bypasses grants, so grants alone cannot do it). Two things pass, and only
--     inside a foreign key's own trigger (pg_trigger_depth() > 1, so a direct statement is
--     refused): clearing actor_id when the actor's account is deleted, which changes nothing
--     else; and deleting the rows of a company that no longer exists.
--   * Row-level security on the seven new tables, with no policy and no grant to
--     app_store_user: the store role reads nothing there (fail closed, the second wall).
-- No backfill: every store today has no store_profiles row, so it stays standalone.
CREATE TYPE "public"."company_invitation_status" AS ENUM('pending', 'accepted', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."company_request_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."company_role" AS ENUM('corporate_admin', 'regional_manager');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspended_reason" text,
	"suspended_by_name" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug"),
	CONSTRAINT "companies_owner_unique" UNIQUE("owner_user_id"),
	CONSTRAINT "companies_name_length" CHECK (char_length("companies"."name") between 2 and 60)
);
--> statement-breakpoint
CREATE TABLE "company_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"event" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "company_role" NOT NULL,
	"region_id" text,
	"inviter_id" text,
	"status" "company_invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_invitations_role_region" CHECK (("company_invitations"."role" = 'regional_manager') = ("company_invitations"."region_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "company_requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"requester_id" text NOT NULL,
	"company_name" text NOT NULL,
	"status" "company_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_by_name" text,
	"decision_reason" text,
	"company_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_requests_name_length" CHECK (char_length("company_requests"."company_name") between 2 and 60)
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regions_company_id_unique" UNIQUE("company_id","id"),
	CONSTRAINT "regions_name_length" CHECK (char_length("regions"."name") between 1 and 40)
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"user_id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"role" "company_role" NOT NULL,
	"region_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_assignments_role_region" CHECK (("role_assignments"."role" = 'regional_manager') = ("role_assignments"."region_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "store_profiles" (
	"store_id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"region_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "help_requests" ADD COLUMN "company_request_id" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "active_store_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_region_fk" FOREIGN KEY ("company_id","region_id") REFERENCES "public"."regions"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_requests" ADD CONSTRAINT "company_requests_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_requests" ADD CONSTRAINT "company_requests_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_requests" ADD CONSTRAINT "company_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_region_fk" FOREIGN KEY ("company_id","region_id") REFERENCES "public"."regions"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD CONSTRAINT "store_profiles_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD CONSTRAINT "store_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD CONSTRAINT "store_profiles_region_fk" FOREIGN KEY ("company_id","region_id") REFERENCES "public"."regions"("company_id","id") ON DELETE set null ("region_id") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_events_company_idx" ON "company_events" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "company_invitations_pending_unique" ON "company_invitations" USING btree ("company_id",lower("email")) WHERE "company_invitations"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "company_requests_pending_unique" ON "company_requests" USING btree ("requester_id") WHERE "company_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "regions_company_name_unique" ON "regions" USING btree ("company_id",lower("name"));--> statement-breakpoint
CREATE INDEX "role_assignments_company_idx" ON "role_assignments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "store_profiles_company_idx" ON "store_profiles" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_company_request_id_company_requests_id_fk" FOREIGN KEY ("company_request_id") REFERENCES "public"."company_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "help_requests_company_request_open_unique" ON "help_requests" USING btree ("company_request_id") WHERE "help_requests"."status" <> 'closed';--> statement-breakpoint
-- Hand-written: company_events is insert-only.
CREATE FUNCTION company_events_insert_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'UPDATE' THEN
		IF pg_trigger_depth() > 1 AND OLD.actor_id IS NOT NULL AND NEW.actor_id IS NULL
			AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN
			RETURN NEW;
		END IF;
	ELSIF TG_OP = 'DELETE' THEN
		IF pg_trigger_depth() > 1 AND NOT EXISTS (SELECT 1 FROM companies WHERE id = OLD.company_id) THEN
			RETURN OLD;
		END IF;
	END IF;
	RAISE EXCEPTION 'company_events is insert-only (% refused)', TG_OP;
END;
$$;--> statement-breakpoint
CREATE TRIGGER company_events_insert_only_row BEFORE UPDATE OR DELETE ON "company_events" FOR EACH ROW EXECUTE FUNCTION company_events_insert_only();--> statement-breakpoint
CREATE TRIGGER company_events_insert_only_truncate BEFORE TRUNCATE ON "company_events" FOR EACH STATEMENT EXECUTE FUNCTION company_events_insert_only();--> statement-breakpoint
-- Hand-written: row-level security, no policy and no grant.
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "regions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "store_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_events" ENABLE ROW LEVEL SECURITY;
