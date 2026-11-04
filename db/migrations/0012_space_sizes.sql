-- Hand-edited after `drizzle-kit generate` (DECISIONS 10-08): generated in two
-- steps and joined here, because drizzle-kit asks interactively whether the
-- dropped stack_limit is a rename of the new size_range. One added statement:
-- an empty product size range becomes null, so blank products inherit their
-- category's range; non-empty ones stay as the product's own (Week 6.5 spec §3.3-§3.5).
CREATE TYPE "public"."product_texture" AS ENUM('solid', 'stripes', 'check', 'dots', 'denim', 'rib');--> statement-breakpoint
ALTER TABLE "product_categories" DROP CONSTRAINT "product_categories_ranges";--> statement-breakpoint
ALTER TABLE "product_footprints" DROP CONSTRAINT "product_footprints_ranges";--> statement-breakpoint
ALTER TABLE "product_categories" DROP COLUMN "stack_limit";--> statement-breakpoint
ALTER TABLE "product_footprints" DROP COLUMN "stack_limit";--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_ranges" CHECK ("product_categories"."hung_columns" between 1 and 48 and "product_categories"."hung_rows" between 1 and 24 and "product_categories"."folded_columns" between 1 and 48 and "product_categories"."folded_rows" between 1 and 24);--> statement-breakpoint
ALTER TABLE "product_footprints" ADD CONSTRAINT "product_footprints_ranges" CHECK ("product_footprints"."grid_columns" between 1 and 48 and "product_footprints"."grid_rows" between 1 and 24);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "size_range" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "size_range" DROP NOT NULL;--> statement-breakpoint
UPDATE "products" SET "size_range" = NULL WHERE "size_range" = '';--> statement-breakpoint
ALTER TABLE "product_categories" ADD COLUMN "size_range" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "swatch" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "texture" "product_texture" DEFAULT 'solid' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_swatch_hex" CHECK ("products"."swatch" ~ '^#[0-9a-f]{6}$');
