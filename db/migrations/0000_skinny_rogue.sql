CREATE TYPE "public"."product_status" AS ENUM('in_stock', 'sold_out', 'on_sale');--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"style_number" text NOT NULL,
	"category" text NOT NULL,
	"color" text NOT NULL,
	"status" "product_status" DEFAULT 'in_stock' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
