CREATE TYPE "public"."build_log_level" AS ENUM('info', 'warn', 'error');--> statement-breakpoint
CREATE TYPE "public"."build_log_stage" AS ENUM('system', 'clone', 'validate', 'install', 'build', 'deploy');--> statement-breakpoint
CREATE TYPE "public"."build_run_status" AS ENUM('queued', 'running', 'deployed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."build_run_trigger" AS ENUM('submission', 'push');--> statement-breakpoint
CREATE TABLE "build_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"build_run_id" uuid NOT NULL,
	"stage" "build_log_stage" NOT NULL,
	"level" "build_log_level" DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"trigger" "build_run_trigger" NOT NULL,
	"status" "build_run_status" DEFAULT 'queued' NOT NULL,
	"branch" text,
	"commit_sha" text,
	"deployment_url" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "repository_full_name" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "repository_default_branch" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "latest_commit_sha" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "deployed_url" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "last_build_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "build_logs" ADD CONSTRAINT "build_logs_build_run_id_build_runs_id_fk" FOREIGN KEY ("build_run_id") REFERENCES "public"."build_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_runs" ADD CONSTRAINT "build_runs_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "build_log_build_run_id_idx" ON "build_logs" USING btree ("build_run_id");--> statement-breakpoint
CREATE INDEX "build_log_build_run_created_at_idx" ON "build_logs" USING btree ("build_run_id","created_at");--> statement-breakpoint
CREATE INDEX "build_run_submission_id_idx" ON "build_runs" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "build_run_status_idx" ON "build_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "build_run_created_at_idx" ON "build_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "submission_repository_full_name_idx" ON "submissions" USING btree ("repository_full_name");