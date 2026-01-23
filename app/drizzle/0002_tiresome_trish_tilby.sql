CREATE TYPE "public"."ClientType" AS ENUM('REGULAR', 'INTERNAL', 'MANAGEMENT');--> statement-breakpoint
CREATE TYPE "public"."TopicType" AS ENUM('REGULAR', 'INTERNAL', 'MANAGEMENT');--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "clientType" "ClientType" DEFAULT 'REGULAR' NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "topicType" "TopicType" DEFAULT 'REGULAR' NOT NULL;