CREATE TYPE "public"."DiscountType" AS ENUM('PERCENTAGE', 'AMOUNT');--> statement-breakpoint
ALTER TABLE "service_description_topics" ADD COLUMN "capHours" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "service_description_topics" ADD COLUMN "discountType" "DiscountType";--> statement-breakpoint
ALTER TABLE "service_description_topics" ADD COLUMN "discountValue" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "service_descriptions" ADD COLUMN "discountType" "DiscountType";--> statement-breakpoint
ALTER TABLE "service_descriptions" ADD COLUMN "discountValue" numeric(10, 2);