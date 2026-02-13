CREATE TYPE "public"."WaiveMode" AS ENUM('EXCLUDED', 'ZERO');--> statement-breakpoint
ALTER TABLE "service_description_line_items" ADD COLUMN "waiveMode" "WaiveMode";