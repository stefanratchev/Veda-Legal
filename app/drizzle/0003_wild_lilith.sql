CREATE TABLE "timesheet_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"date" date NOT NULL,
	"submittedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timesheet_submissions" ADD CONSTRAINT "timesheet_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "timesheet_submissions_userId_idx" ON "timesheet_submissions" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "timesheet_submissions_date_idx" ON "timesheet_submissions" USING btree ("date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "timesheet_submissions_userId_date_key" ON "timesheet_submissions" USING btree ("userId" text_ops,"date" date_ops);