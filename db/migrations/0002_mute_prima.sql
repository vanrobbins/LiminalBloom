-- Hand-edited after generation. drizzle-kit produced a single
--     ALTER TABLE "products" ADD COLUMN "store_id" text NOT NULL;
-- which Postgres rejects on a table that already has rows: the existing five
-- products would each need a value and there is no default to give them.
--
-- The safe shape is three steps: add the column nullable, give the existing
-- rows a value, then tighten it to NOT NULL. Adding a required column to a
-- populated table always needs this, and the generator cannot know what the
-- backfill value should be.

--> add the column, nullable for now
ALTER TABLE "products" ADD COLUMN "store_id" text;--> statement-breakpoint

--> backfill: existing products belong to the first store created
UPDATE "products"
   SET "store_id" = (SELECT "id" FROM "organization" ORDER BY "created_at" ASC LIMIT 1)
 WHERE "store_id" IS NULL;--> statement-breakpoint

--> if there was no store at all, the rows above are still null and cannot be
--> made NOT NULL. They are seed data, so drop them rather than fail the
--> migration. On a database with a store, this deletes nothing.
DELETE FROM "products" WHERE "store_id" IS NULL;--> statement-breakpoint

--> now the column can be required
ALTER TABLE "products" ALTER COLUMN "store_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "products" ADD CONSTRAINT "products_store_id_organization_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
