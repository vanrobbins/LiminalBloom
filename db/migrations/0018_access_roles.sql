-- Hand-edited after `drizzle-kit generate` (DECISIONS 10-08, "0.7" 11-11). Tables,
-- columns, indexes and the foreign keys to organization and user are as generated,
-- and so is the snapshot. Written by hand, because drizzle-kit cannot express them
-- and does not track them:
--   * role_definitions_rank_unique is DEFERRABLE INITIALLY IMMEDIATE (as 0014 did
--     for fixtures): renumbering ranks passes through duplicates inside a batch
--     that first runs SET CONSTRAINTS role_definitions_rank_unique DEFERRED.
--   * The composite foreign keys from member and invitation (organization_id,
--     role_id) to role_definitions (store_id, id), which the generator cannot aim
--     at an app table from Better Auth's generated tables. ON DELETE NO ACTION,
--     not RESTRICT, so deleting a whole store still cascades (its roles, members
--     and invitations all go in one statement) while a role someone holds cannot
--     be deleted alone. A null role_id is not checked (MATCH SIMPLE).
--   * Grants to app_store_user, row-level security and the store_isolation
--     policies, as in 0011. access_events is insert-only: select and insert only.
--   * The backfill: the five built-in roles for every existing store, with the
--     names, ranks and switches of lib/access/roles.ts, then member.role_id from
--     member.role (a comma-separated list: owner, else admin, else member).
--     Pending invitations keep a null role_id.
-- The index and unique constraints are created before the keys that need them.
CREATE TABLE "access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"event" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_definitions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"store_id" text NOT NULL,
	"builtin" text,
	"name" text NOT NULL,
	"rank" integer NOT NULL,
	"switches" text[] NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_definitions_builtin_unique" UNIQUE("store_id","builtin"),
	CONSTRAINT "role_definitions_rank_unique" UNIQUE("store_id","rank") DEFERRABLE INITIALLY IMMEDIATE,
	CONSTRAINT "role_definitions_rank_positive" CHECK ("role_definitions"."rank" > 0),
	CONSTRAINT "role_definitions_builtin_known" CHECK ("role_definitions"."builtin" is null or "role_definitions"."builtin" in ('store_manager', 'assistant_manager', 'vm_manager', 'vm_worker', 'sales_associate'))
);
--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN "role_id" text;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "role_id" text;--> statement-breakpoint
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_definitions" ADD CONSTRAINT "role_definitions_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_events_store_idx" ON "access_events" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "role_definitions_store_id_unique" ON "role_definitions" USING btree ("store_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_definitions_name_unique" ON "role_definitions" USING btree ("store_id",lower("name"));--> statement-breakpoint
-- Hand-written: backfill. The switches below are lib/access/roles.ts, in list order.
INSERT INTO "role_definitions" ("store_id", "builtin", "name", "rank", "switches")
  SELECT o."id", b."builtin", b."name", b."rank", b."switches"
  FROM "organization" o
  CROSS JOIN (VALUES
    ('store_manager', 'Store Manager', 100, ARRAY['view', 'products.stock', 'products.sale', 'planograms.draft', 'planograms.publish', 'layout.edit', 'products.edit', 'people.manage', 'roles.manage', 'store.settings']),
    ('assistant_manager', 'Assistant Manager', 200, ARRAY['view', 'products.stock', 'products.sale', 'planograms.draft', 'planograms.publish', 'layout.edit', 'products.edit', 'people.manage', 'roles.manage']),
    ('vm_manager', 'Visual Merchandising Manager', 300, ARRAY['view', 'products.stock', 'products.sale', 'planograms.draft', 'planograms.publish', 'layout.edit', 'products.edit', 'people.manage']),
    ('vm_worker', 'Visual Merchandising Worker', 400, ARRAY['view', 'products.stock', 'products.sale', 'planograms.draft']),
    ('sales_associate', 'Sales Associate', 500, ARRAY['view', 'products.stock'])
  ) AS b("builtin", "name", "rank", "switches");--> statement-breakpoint
UPDATE "member" m SET "role_id" = r."id"
  FROM "role_definitions" r
  WHERE r."store_id" = m."organization_id"
    AND r."builtin" = CASE
      WHEN 'owner' = ANY (string_to_array(replace(m."role", ' ', ''), ',')) THEN 'store_manager'
      WHEN 'admin' = ANY (string_to_array(replace(m."role", ' ', ''), ',')) THEN 'assistant_manager'
      ELSE 'sales_associate'
    END;--> statement-breakpoint
-- Hand-written: the composite foreign keys, after the backfill so they check it.
ALTER TABLE "member" ADD CONSTRAINT "member_role_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "public"."role_definitions"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_role_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "public"."role_definitions"("store_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Hand-written: grants and row-level security, as in 0011. The log is insert-only.
GRANT SELECT, INSERT, UPDATE, DELETE ON "role_definitions" TO app_store_user;--> statement-breakpoint
GRANT SELECT, INSERT ON "access_events" TO app_store_user;--> statement-breakpoint
ALTER TABLE "role_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "access_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "store_isolation" ON "role_definitions" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));--> statement-breakpoint
CREATE POLICY "store_isolation" ON "access_events" TO app_store_user USING (store_id = current_setting('app.store_id', true)) WITH CHECK (store_id = current_setting('app.store_id', true));
