ALTER TABLE "sales_promoters" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "sales_promoters" CASCADE;--> statement-breakpoint
DROP INDEX "uniq_email_reports_message_file";--> statement-breakpoint
DROP INDEX "idx_email_reports_message";--> statement-breakpoint
ALTER TABLE "email_reports" ADD COLUMN "processed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "email_reports" ADD COLUMN "report_name" text;--> statement-breakpoint
ALTER TABLE "email_reports" ADD COLUMN "report_date" date;--> statement-breakpoint
CREATE INDEX "idx_email_reports_message" ON "email_reports" USING btree ("message_id");--> statement-breakpoint
ALTER TABLE "email_reports" DROP COLUMN "payload_hash";--> statement-breakpoint
ALTER TABLE "email_reports" DROP COLUMN "fingerprint";--> statement-breakpoint
ALTER TABLE "email_reports" DROP COLUMN "schema_version";--> statement-breakpoint
ALTER TABLE "email_reports" DROP COLUMN "report_type";--> statement-breakpoint
ALTER TABLE "email_reports" DROP COLUMN "cycle_date";--> statement-breakpoint
ALTER TABLE "email_reports" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "email_reports" DROP COLUMN "is_latest_version";--> statement-breakpoint
ALTER TABLE "email_reports" DROP COLUMN "sheet_count";--> statement-breakpoint
ALTER TABLE "email_reports" DROP COLUMN "numeric_ratio";--> statement-breakpoint
ALTER TABLE "email_reports" DROP COLUMN "has_ageing_pattern";--> statement-breakpoint
ALTER TABLE "email_reports" DROP COLUMN "has_date_pattern";--> statement-breakpoint
ALTER TABLE "email_reports" DROP COLUMN "processing_stage";