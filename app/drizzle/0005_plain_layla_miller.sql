CREATE TYPE "public"."LeaveStatus" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."LeaveType" AS ENUM('VACATION', 'SICK_LEAVE', 'MATERNITY_PATERNITY');--> statement-breakpoint
CREATE TABLE "leave_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date NOT NULL,
	"leaveType" "LeaveType" NOT NULL,
	"status" "LeaveStatus" DEFAULT 'PENDING' NOT NULL,
	"reason" text,
	"reviewedById" text,
	"reviewedAt" timestamp(3),
	"rejectionReason" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leave_periods" ADD CONSTRAINT "leave_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_periods" ADD CONSTRAINT "leave_periods_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "leave_periods_userId_idx" ON "leave_periods" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "leave_periods_status_idx" ON "leave_periods" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "leave_periods_startDate_idx" ON "leave_periods" USING btree ("startDate" date_ops);