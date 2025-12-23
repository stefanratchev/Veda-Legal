-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."ClientStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."Position" AS ENUM('ADMIN', 'PARTNER', 'SENIOR_ASSOCIATE', 'ASSOCIATE', 'CONSULTANT');--> statement-breakpoint
CREATE TYPE "public"."PracticeArea" AS ENUM('CORPORATE', 'FAMILY_LAW', 'IP_PATENT', 'REAL_ESTATE', 'LITIGATION', 'EMPLOYMENT', 'TAX', 'IMMIGRATION', 'CRIMINAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."PricingMode" AS ENUM('HOURLY', 'FIXED');--> statement-breakpoint
CREATE TYPE "public"."ServiceDescriptionStatus" AS ENUM('DRAFT', 'FINALIZED');--> statement-breakpoint
CREATE TYPE "public"."SubtopicStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."TopicStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."UserStatus" AS ENUM('PENDING', 'ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TABLE "service_description_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"serviceDescriptionId" text NOT NULL,
	"topicName" text NOT NULL,
	"displayOrder" integer DEFAULT 0 NOT NULL,
	"pricingMode" "PricingMode" DEFAULT 'HOURLY' NOT NULL,
	"hourlyRate" numeric(10, 2),
	"fixedFee" numeric(10, 2),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_descriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"periodStart" date NOT NULL,
	"periodEnd" date NOT NULL,
	"status" "ServiceDescriptionStatus" DEFAULT 'DRAFT' NOT NULL,
	"finalizedAt" timestamp(3),
	"finalizedById" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_description_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"topicId" text NOT NULL,
	"timeEntryId" text,
	"date" date,
	"description" text NOT NULL,
	"hours" numeric(4, 2),
	"fixedAmount" numeric(10, 2),
	"displayOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_prisma_migrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"status" "UserStatus" DEFAULT 'PENDING' NOT NULL,
	"lastLogin" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"position" "Position" DEFAULT 'ASSOCIATE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"invoicedName" text,
	"invoiceAttn" text,
	"email" text,
	"hourlyRate" numeric(10, 2),
	"phone" text,
	"address" text,
	"practiceArea" "PracticeArea",
	"status" "ClientStatus" DEFAULT 'ACTIVE' NOT NULL,
	"notes" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"secondaryEmails" text
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"displayOrder" integer DEFAULT 0 NOT NULL,
	"status" "TopicStatus" DEFAULT 'ACTIVE' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtopics" (
	"id" text PRIMARY KEY NOT NULL,
	"topicId" text NOT NULL,
	"name" text NOT NULL,
	"isPrefix" boolean DEFAULT false NOT NULL,
	"displayOrder" integer DEFAULT 0 NOT NULL,
	"status" "SubtopicStatus" DEFAULT 'ACTIVE' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"hours" numeric(4, 2) NOT NULL,
	"description" text NOT NULL,
	"userId" text NOT NULL,
	"clientId" text NOT NULL,
	"subtopicId" text,
	"topicName" text DEFAULT '' NOT NULL,
	"subtopicName" text DEFAULT '' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_description_topics" ADD CONSTRAINT "service_description_topics_serviceDescriptionId_fkey" FOREIGN KEY ("serviceDescriptionId") REFERENCES "public"."service_descriptions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "service_descriptions" ADD CONSTRAINT "service_descriptions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "service_descriptions" ADD CONSTRAINT "service_descriptions_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "service_description_line_items" ADD CONSTRAINT "service_description_line_items_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."service_description_topics"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "service_description_line_items" ADD CONSTRAINT "service_description_line_items_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "public"."time_entries"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subtopics" ADD CONSTRAINT "subtopics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "public"."subtopics"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "service_description_topics_serviceDescriptionId_idx" ON "service_description_topics" USING btree ("serviceDescriptionId" text_ops);--> statement-breakpoint
CREATE INDEX "service_descriptions_clientId_idx" ON "service_descriptions" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "service_descriptions_status_idx" ON "service_descriptions" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "service_description_line_items_timeEntryId_idx" ON "service_description_line_items" USING btree ("timeEntryId" text_ops);--> statement-breakpoint
CREATE INDEX "service_description_line_items_topicId_idx" ON "service_description_line_items" USING btree ("topicId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "subtopics_topicId_idx" ON "subtopics" USING btree ("topicId" text_ops);--> statement-breakpoint
CREATE INDEX "time_entries_clientId_idx" ON "time_entries" USING btree ("clientId" text_ops);--> statement-breakpoint
CREATE INDEX "time_entries_date_idx" ON "time_entries" USING btree ("date" date_ops);--> statement-breakpoint
CREATE INDEX "time_entries_subtopicId_idx" ON "time_entries" USING btree ("subtopicId" text_ops);--> statement-breakpoint
CREATE INDEX "time_entries_userId_idx" ON "time_entries" USING btree ("userId" text_ops);
*/