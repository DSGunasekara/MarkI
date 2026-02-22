CREATE TYPE "public"."ai_report_message_role" AS ENUM('employer', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."ai_report_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."build_log_stage" ADD VALUE 'analyze';--> statement-breakpoint
CREATE TABLE "ai_report_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_report_id" uuid NOT NULL,
	"role" "ai_report_message_role" NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"build_run_id" uuid,
	"status" "ai_report_status" DEFAULT 'pending' NOT NULL,
	"model" text,
	"project_overview" text,
	"notable_structure" text,
	"engineering_strengths" text[] DEFAULT '{}' NOT NULL,
	"risks_or_concerns" text[] DEFAULT '{}' NOT NULL,
	"suggested_questions" text[] DEFAULT '{}' NOT NULL,
	"analysis_context" text,
	"raw_response" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_report_messages" ADD CONSTRAINT "ai_report_messages_ai_report_id_ai_reports_id_fk" FOREIGN KEY ("ai_report_id") REFERENCES "public"."ai_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_build_run_id_build_runs_id_fk" FOREIGN KEY ("build_run_id") REFERENCES "public"."build_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_report_message_report_id_idx" ON "ai_report_messages" USING btree ("ai_report_id");--> statement-breakpoint
CREATE INDEX "ai_report_message_created_at_idx" ON "ai_report_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_report_submission_id_idx" ON "ai_reports" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "ai_report_build_run_id_idx" ON "ai_reports" USING btree ("build_run_id");--> statement-breakpoint
CREATE INDEX "ai_report_created_at_idx" ON "ai_reports" USING btree ("created_at");