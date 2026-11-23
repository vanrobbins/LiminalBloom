-- (A3c adds passkey_last_used: when each passkey last signed in, kept beside Better Auth's passkey table; RLS on, no grant.)
-- Hand-edited after `drizzle-kit generate` (DECISIONS 10-08, "0.7.1"). Tables, columns,
-- enums, indexes, checks and foreign keys are as generated, and so is the snapshot. That
-- includes Better Auth's own additions (two_factor, passkey, user.two_factor_enabled,
-- session.two_factor_at: db/auth-schema.ts, regenerated with lib/auth.ts). Written by
-- hand, because drizzle-kit cannot express them and does not track them:
--   * platform_events is insert-only: a trigger refuses UPDATE, DELETE and TRUNCATE (the
--     owner connection bypasses grants, so grants alone cannot do it). The one update it
--     lets through is the foreign key clearing actor_id when the actor's account is
--     deleted, which changes nothing else. pg_trigger_depth() > 1 means it runs inside
--     the foreign key's own trigger, so a direct UPDATE clearing actor_id is refused too.
--   * Row-level security on the five app tables, with no policy and no grant to
--     app_store_user: the store role reads nothing there (fail closed, the second wall).
--     two_factor and passkey, like the other Better Auth tables, are never granted.
--   * passkey_last_used gets row-level security too, with no policy and no grant.
--   * The backfill for role_definitions.requires_two_factor: on for every role that holds
--     people.manage or roles.manage (lib/access/switches.ts), off for the rest.
CREATE TYPE "public"."help_kind" AS ENUM('account', 'company_request', 'broken', 'other');--> statement-breakpoint
CREATE TYPE "public"."help_status" AS ENUM('open', 'answered', 'closed');--> statement-breakpoint
CREATE TABLE "help_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"author_id" text,
	"author_name" text NOT NULL,
	"from_admin" boolean DEFAULT false NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_messages_body_length" CHECK (char_length("help_messages"."body") between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "help_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" text NOT NULL,
	"kind" "help_kind" NOT NULL,
	"status" "help_status" DEFAULT 'open' NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requester_seen_at" timestamp with time zone,
	"admin_seen_at" timestamp with time zone,
	"closed_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_requests_closed_by_check" CHECK (("help_requests"."closed_by" is not null) = ("help_requests"."status" = 'closed')),
	CONSTRAINT "help_requests_closed_by_known" CHECK ("help_requests"."closed_by" is null or "help_requests"."closed_by" in ('requester', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"user_id" text PRIMARY KEY NOT NULL,
	"added_by" text,
	"added_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" text NOT NULL,
	"target_label" text NOT NULL,
	"company_id" text,
	"reason" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_suspensions" (
	"store_id" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"suspended_by" text,
	"suspended_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey_last_used" (
	"passkey_id" text PRIMARY KEY NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp
);
--> statement-breakpoint
ALTER TABLE "role_definitions" ADD COLUMN "requires_two_factor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "two_factor_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "help_messages" ADD CONSTRAINT "help_messages_request_id_help_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."help_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_messages" ADD CONSTRAINT "help_messages_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_suspensions" ADD CONSTRAINT "store_suspensions_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_suspensions" ADD CONSTRAINT "store_suspensions_suspended_by_user_id_fk" FOREIGN KEY ("suspended_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey_last_used" ADD CONSTRAINT "passkey_last_used_passkey_id_passkey_id_fk" FOREIGN KEY ("passkey_id") REFERENCES "public"."passkey"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "help_messages_request_idx" ON "help_messages" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "help_requests_requester_idx" ON "help_requests" USING btree ("requester_id","status");--> statement-breakpoint
CREATE INDEX "help_requests_status_idx" ON "help_requests" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "platform_events_created_idx" ON "platform_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_events_company_idx" ON "platform_events" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
-- Hand-written: platform_events is insert-only.
CREATE FUNCTION platform_events_insert_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1 AND OLD.actor_id IS NOT NULL AND NEW.actor_id IS NULL
		AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN
		RETURN NEW;
	END IF;
	RAISE EXCEPTION 'platform_events is insert-only (% refused)', TG_OP;
END;
$$;--> statement-breakpoint
CREATE TRIGGER platform_events_insert_only_row BEFORE UPDATE OR DELETE ON "platform_events" FOR EACH ROW EXECUTE FUNCTION platform_events_insert_only();--> statement-breakpoint
CREATE TRIGGER platform_events_insert_only_truncate BEFORE TRUNCATE ON "platform_events" FOR EACH STATEMENT EXECUTE FUNCTION platform_events_insert_only();--> statement-breakpoint
-- Hand-written: row-level security, no policy and no grant.
ALTER TABLE "platform_admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "store_suspensions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "help_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "help_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "passkey_last_used" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Hand-written: backfill. Roles that manage people or roles must have two-factor.
UPDATE "role_definitions" SET "requires_two_factor" = true WHERE "switches" && ARRAY['roles.manage', 'people.manage']::text[];
