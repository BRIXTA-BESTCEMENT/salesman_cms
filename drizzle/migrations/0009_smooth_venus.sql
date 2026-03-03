ALTER TABLE "daily_visit_reports" DROP CONSTRAINT "fk_dvr_dealer_id";
--> statement-breakpoint
ALTER TABLE "daily_visit_reports" DROP CONSTRAINT "fk_dvr_sub_dealer_id";
--> statement-breakpoint
ALTER TABLE "daily_visit_reports" DROP CONSTRAINT "daily_visit_reports_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "daily_visit_reports" DROP CONSTRAINT "fk_daily_visit_reports_pjp_id";
--> statement-breakpoint
DROP INDEX "idx_daily_visit_reports_pjp_id";--> statement-breakpoint
DROP INDEX "idx_daily_visit_reports_user_id";--> statement-breakpoint
DROP INDEX "idx_dvr_dealer_id";--> statement-breakpoint
DROP INDEX "idx_dvr_sub_dealer_id";--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "report_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "dealer_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "location" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "latitude" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "longitude" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "visit_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "dealer_total_potential" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "dealer_best_potential" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "today_order_mt" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "today_collection_rupees" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "feedbacks" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "time_spent_in_loc" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_sub_dealer_id_dealers_id_fk" FOREIGN KEY ("sub_dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_pjp_id_permanent_journey_plans_id_fk" FOREIGN KEY ("pjp_id") REFERENCES "public"."permanent_journey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_daily_visit_reports_pjp_id" ON "daily_visit_reports" USING btree ("pjp_id");--> statement-breakpoint
CREATE INDEX "idx_daily_visit_reports_user_id" ON "daily_visit_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dvr_dealer_id" ON "daily_visit_reports" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "idx_dvr_sub_dealer_id" ON "daily_visit_reports" USING btree ("sub_dealer_id");