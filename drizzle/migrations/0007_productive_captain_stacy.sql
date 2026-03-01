CREATE TABLE "logistics_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" varchar(255),
	"user_name" varchar(255) NOT NULL,
	"user_password" varchar(255) NOT NULL,
	"user_role" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "logistics_users_user_name_unique" UNIQUE("user_name")
);
--> statement-breakpoint
CREATE TABLE "sales_promoters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"mobile" varchar(20),
	"email" varchar(255),
	"zone" varchar(120),
	"district" varchar(120),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aoi" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "aoi_grid_cell" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "construction_site" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "detected_building" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "grid_change_score" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "highres_scene" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "satellite_scene" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tally_raw" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tso_visit" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "aoi" CASCADE;--> statement-breakpoint
DROP TABLE "aoi_grid_cell" CASCADE;--> statement-breakpoint
DROP TABLE "construction_site" CASCADE;--> statement-breakpoint
DROP TABLE "detected_building" CASCADE;--> statement-breakpoint
DROP TABLE "grid_change_score" CASCADE;--> statement-breakpoint
DROP TABLE "highres_scene" CASCADE;--> statement-breakpoint
DROP TABLE "satellite_scene" CASCADE;--> statement-breakpoint
DROP TABLE "tally_raw" CASCADE;--> statement-breakpoint
DROP TABLE "tso_visit" CASCADE;--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP CONSTRAINT "daily_tasks_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP CONSTRAINT "daily_tasks_assigned_by_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP CONSTRAINT "daily_tasks_related_dealer_id_fkey";
--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP CONSTRAINT "daily_tasks_pjp_id_fkey";
--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP CONSTRAINT "daily_tasks_site_id_fkey";
--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP CONSTRAINT "daily_tasks_related_verified_dealer_id_fkey";
--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP CONSTRAINT "verified_dealers_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP CONSTRAINT "verified_dealers_dealer_id_dealers_id_fk";
--> statement-breakpoint
DROP INDEX "idx_daily_tasks_assigned_by_user_id";--> statement-breakpoint
DROP INDEX "idx_daily_tasks_date_user";--> statement-breakpoint
DROP INDEX "idx_daily_tasks_pjp_id";--> statement-breakpoint
DROP INDEX "idx_daily_tasks_related_dealer_id";--> statement-breakpoint
DROP INDEX "idx_daily_tasks_related_verified_dealer_id";--> statement-breakpoint
DROP INDEX "idx_daily_tasks_site_id";--> statement-breakpoint
DROP INDEX "idx_daily_tasks_status";--> statement-breakpoint
DROP INDEX "idx_daily_tasks_task_date";--> statement-breakpoint
DROP INDEX "idx_daily_tasks_user_id";--> statement-breakpoint
ALTER TABLE "daily_tasks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "daily_tasks" ALTER COLUMN "visit_type" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "daily_tasks" ALTER COLUMN "visit_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_tasks" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_tasks" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "daily_tasks" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_tasks" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "logistics_io" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "logistics_io" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "logistics_io" ALTER COLUMN "createdAt" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "logistics_io" ALTER COLUMN "createdAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "logistics_io" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "logistics_io" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "verified_dealers" ALTER COLUMN "dealer_party_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "verified_dealers" ALTER COLUMN "zone" SET DATA TYPE varchar(120);--> statement-breakpoint
ALTER TABLE "verified_dealers" ALTER COLUMN "area" SET DATA TYPE varchar(120);--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "pjp_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "dealer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "dealer_name_snapshot" varchar(255);--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "dealer_mobile" varchar(20);--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "zone" varchar(120);--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "area" varchar(120);--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "route" text;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "objective" varchar(255);--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "required_visit_count" integer;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "week" varchar(50);--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "source_name" varchar(255);--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "alias" varchar(255);--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "district" varchar(120);--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "state" varchar(100);--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "contact_person" varchar(255);--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "dealer_segment" varchar(255);--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "sales_promoter_id" integer;--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "sales_man_name_raw" varchar(255);--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "credit_limit" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "security_blank_cheque_no" varchar(255);--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD CONSTRAINT "verified_dealers_sales_promoter_id_sales_promoters_id_fk" FOREIGN KEY ("sales_promoter_id") REFERENCES "public"."sales_promoters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_user" ON "daily_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_dealer" ON "daily_tasks" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_date" ON "daily_tasks" USING btree ("task_date");--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_zone" ON "daily_tasks" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_week" ON "daily_tasks" USING btree ("week");--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_pjp_batch" ON "daily_tasks" USING btree ("pjp_batch_id");--> statement-breakpoint
CREATE INDEX "idx_verified_zone" ON "verified_dealers" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "idx_verified_district" ON "verified_dealers" USING btree ("district");--> statement-breakpoint
CREATE INDEX "idx_verified_pincode" ON "verified_dealers" USING btree ("pin_code");--> statement-breakpoint
CREATE INDEX "idx_verified_sales_promoter" ON "verified_dealers" USING btree ("sales_promoter_id");--> statement-breakpoint
CREATE INDEX "idx_verified_segment" ON "verified_dealers" USING btree ("dealer_segment");--> statement-breakpoint
CREATE INDEX "idx_verified_gst" ON "verified_dealers" USING btree ("gst_no");--> statement-breakpoint
CREATE INDEX "idx_verified_mobile" ON "verified_dealers" USING btree ("contact_no1");--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP COLUMN "assigned_by_user_id";--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP COLUMN "related_dealer_id";--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP COLUMN "site_name";--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP COLUMN "pjp_id";--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP COLUMN "site_id";--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP COLUMN "dealer_name";--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP COLUMN "dealer_category";--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP COLUMN "pjp_cycle";--> statement-breakpoint
ALTER TABLE "daily_tasks" DROP COLUMN "related_verified_dealer_id";--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "dealer_code";--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "dealer_category";--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "is_subdealer";--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "related_sp_name";--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "owner_proprietor_name";--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "nature_of_firm";--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "verified_dealers" DROP COLUMN "dealer_id";