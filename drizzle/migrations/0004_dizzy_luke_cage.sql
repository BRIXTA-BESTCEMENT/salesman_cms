ALTER TABLE "dealer_financial_snapshot" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dealer_intelligence_snapshot" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dealer_trend_metrics" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "dealer_financial_snapshot" CASCADE;--> statement-breakpoint
DROP TABLE "dealer_intelligence_snapshot" CASCADE;--> statement-breakpoint
DROP TABLE "dealer_trend_metrics" CASCADE;--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP CONSTRAINT "fk_verified_dealers_user_id";
--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP CONSTRAINT "fk_verified_dealers_dealer_id";
--> statement-breakpoint
DROP INDEX "idx_verified_dealer_code";--> statement-breakpoint
DROP INDEX "idx_verified_dealer_fk";--> statement-breakpoint
DROP INDEX "idx_verified_user";--> statement-breakpoint
DROP INDEX "uniq_verified_dealer_fk";--> statement-breakpoint
DROP INDEX "uniq_verified_party_name";--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "related_sp_name" varchar(255);--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD CONSTRAINT "verified_dealers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD CONSTRAINT "verified_dealers_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "credit_limit";--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "credit_days_allowed";--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "updated_at";