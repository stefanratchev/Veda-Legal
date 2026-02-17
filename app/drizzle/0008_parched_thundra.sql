ALTER TABLE "clients" ADD COLUMN "retainerFee" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "retainerHours" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "service_descriptions" ADD COLUMN "retainerFee" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "service_descriptions" ADD COLUMN "retainerHours" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "service_descriptions" ADD COLUMN "retainerOverageRate" numeric(10, 2);