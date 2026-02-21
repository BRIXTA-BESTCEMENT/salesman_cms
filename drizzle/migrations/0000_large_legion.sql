-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "dealer_reports_and_scores" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"dealer_id" text NOT NULL,
	"dealer_score" numeric(10, 2) NOT NULL,
	"trust_worthiness_score" numeric(10, 2) NOT NULL,
	"credit_worthiness_score" numeric(10, 2) NOT NULL,
	"order_history_score" numeric(10, 2) NOT NULL,
	"visit_frequency_score" numeric(10, 2) NOT NULL,
	"last_updated_date" timestamp(6) with time zone NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technical_visit_reports" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"report_date" date NOT NULL,
	"visit_type" varchar(50) NOT NULL,
	"site_name_concerned_person" varchar(255) NOT NULL,
	"phone_no" varchar(20) NOT NULL,
	"email_id" varchar(255),
	"clients_remarks" varchar(500) NOT NULL,
	"salesperson_remarks" varchar(500) NOT NULL,
	"check_in_time" timestamp(6) with time zone NOT NULL,
	"check_out_time" timestamp(6) with time zone,
	"in_time_image_url" varchar(500),
	"out_time_image_url" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"associated_party_name" text,
	"channel_partner_visit" text,
	"conversion_from_brand" text,
	"conversion_quantity_unit" varchar(20),
	"conversion_quantity_value" numeric(10, 2),
	"promotional_activity" text,
	"quality_complaint" text,
	"service_type" text,
	"site_visit_stage" text,
	"site_visit_brand_in_use" text[] DEFAULT '{""}' NOT NULL,
	"influencer_type" text[] DEFAULT '{""}' NOT NULL,
	"site_visit_type" varchar(50),
	"dhalai_verification_code" varchar(50),
	"is_verification_status" varchar(50),
	"meeting_id" varchar(255),
	"pjp_id" varchar(255),
	"purpose_of_visit" varchar(500),
	"site_photo_url" varchar(500),
	"first_visit_time" timestamp with time zone,
	"last_visit_time" timestamp with time zone,
	"first_visit_day" varchar(100),
	"last_visit_day" varchar(100),
	"site_visits_count" integer,
	"other_visits_count" integer,
	"total_visits_count" integer,
	"region" varchar(100),
	"area" varchar(100),
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"mason_id" uuid,
	"time_spent_in_loc" text,
	"site_id" uuid,
	"market_name" varchar(100),
	"site_address" varchar(500),
	"whatsapp_no" varchar(20),
	"visit_category" varchar(50),
	"customer_type" varchar(50),
	"const_area_sq_ft" integer,
	"current_brand_price" numeric(10, 2),
	"site_stock" numeric(10, 2),
	"est_requirement" numeric(10, 2),
	"supplying_dealer_name" varchar(255),
	"nearby_dealer_name" varchar(255),
	"is_converted" boolean,
	"conversion_type" varchar(50),
	"is_tech_service" boolean,
	"service_desc" varchar(500),
	"influencer_name" varchar(255),
	"influencer_phone" varchar(20),
	"is_scheme_enrolled" boolean,
	"influencer_productivity" varchar(100),
	"journey_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"workos_user_id" text,
	"company_id" integer NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"phone_number" varchar(50),
	"inviteToken" text,
	"status" text DEFAULT 'active' NOT NULL,
	"salesman_login_id" text,
	"hashed_password" text,
	"reports_to_id" integer,
	"area" text,
	"region" text,
	"no_of_pjp" integer,
	"is_technical_role" boolean DEFAULT false NOT NULL,
	"tech_login_id" text,
	"tech_hash_password" text,
	"device_id" varchar(255),
	"fcm_token" varchar(500),
	"admin_app_login_id" text,
	"admin_app_hashed_password" text,
	"is_admin_app_user" boolean DEFAULT false NOT NULL,
	CONSTRAINT "uniq_user_device_id" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"area" text NOT NULL,
	"region" text NOT NULL,
	"rating" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealer_brand_mapping" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"dealer_id" text NOT NULL,
	"brand_id" integer NOT NULL,
	"capacity_mt" numeric(12, 2) NOT NULL,
	"user_id" integer,
	"best_capacity_mt" numeric(12, 2),
	"brand_growth_capacity_percent" numeric(5, 2),
	"verified_dealer_id" integer
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_visit_reports" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"report_date" date NOT NULL,
	"dealer_type" varchar(50) NOT NULL,
	"location" varchar(500) NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"visit_type" varchar(50) NOT NULL,
	"dealer_total_potential" numeric(10, 2) NOT NULL,
	"dealer_best_potential" numeric(10, 2) NOT NULL,
	"brand_selling" text[],
	"contact_person" varchar(255),
	"contact_person_phone_no" varchar(20),
	"today_order_mt" numeric(10, 2) NOT NULL,
	"today_collection_rupees" numeric(10, 2) NOT NULL,
	"feedbacks" varchar(500) NOT NULL,
	"solution_by_salesperson" varchar(500),
	"any_remarks" varchar(500),
	"check_in_time" timestamp(6) with time zone NOT NULL,
	"check_out_time" timestamp(6) with time zone,
	"in_time_image_url" varchar(500),
	"out_time_image_url" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"overdue_amount" numeric(12, 2),
	"pjp_id" varchar(255),
	"dealer_id" varchar(255),
	"sub_dealer_id" varchar(255),
	"time_spent_in_loc" text
);
--> statement-breakpoint
CREATE TABLE "permanent_journey_plans" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plan_date" date NOT NULL,
	"area_to_be_visited" varchar(500) NOT NULL,
	"description" varchar(500),
	"status" varchar(50) NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_by_id" integer NOT NULL,
	"verification_status" varchar(50),
	"additional_visit_remarks" varchar(500),
	"dealer_id" varchar(255),
	"bulk_op_id" varchar(50),
	"idempotency_key" varchar(120),
	"site_id" uuid,
	"route" varchar(500),
	"planned_new_site_visits" integer DEFAULT 0,
	"planned_follow_up_site_visits" integer DEFAULT 0,
	"planned_new_dealer_visits" integer DEFAULT 0,
	"planned_influencer_visits" integer DEFAULT 0,
	"influencer_name" varchar(255),
	"influencer_phone" varchar(20),
	"activity_type" varchar(255),
	"noof_converted_bags" integer DEFAULT 0,
	"noof_masonpc_in_schemes" integer DEFAULT 0,
	"diversion_reason" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"office_address" text NOT NULL,
	"is_head_office" boolean DEFAULT true NOT NULL,
	"phone_number" varchar(50) NOT NULL,
	"admin_user_id" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"workos_organization_id" text,
	"area" text,
	"region" text
);
--> statement-breakpoint
CREATE TABLE "salesman_leave_applications" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"leave_type" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" varchar(500) NOT NULL,
	"status" varchar(50) NOT NULL,
	"admin_remarks" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salesman_attendance" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"attendance_date" date NOT NULL,
	"location_name" varchar(500) NOT NULL,
	"in_time_timestamp" timestamp(6) with time zone NOT NULL,
	"out_time_timestamp" timestamp(6) with time zone,
	"in_time_image_captured" boolean NOT NULL,
	"out_time_image_captured" boolean NOT NULL,
	"in_time_image_url" varchar(500),
	"out_time_image_url" varchar(500),
	"in_time_latitude" numeric(10, 7) NOT NULL,
	"in_time_longitude" numeric(10, 7) NOT NULL,
	"in_time_accuracy" numeric(10, 2),
	"in_time_speed" numeric(10, 2),
	"in_time_heading" numeric(10, 2),
	"in_time_altitude" numeric(10, 2),
	"out_time_latitude" numeric(10, 7),
	"out_time_longitude" numeric(10, 7),
	"out_time_accuracy" numeric(10, 2),
	"out_time_speed" numeric(10, 2),
	"out_time_heading" numeric(10, 2),
	"out_time_altitude" numeric(10, 2),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"role" varchar(50) DEFAULT 'SALES'
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
CREATE TABLE "competition_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"report_date" date NOT NULL,
	"brand_name" varchar(255) NOT NULL,
	"billing" varchar(100) NOT NULL,
	"nod" varchar(100) NOT NULL,
	"retail" varchar(100) NOT NULL,
	"schemes_yes_no" varchar(10) NOT NULL,
	"avg_scheme_cost" numeric(10, 2) NOT NULL,
	"remarks" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_tracking" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"recorded_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"accuracy" numeric(10, 2),
	"speed" numeric(10, 2),
	"heading" numeric(10, 2),
	"altitude" numeric(10, 2),
	"location_type" varchar(50),
	"activity_type" varchar(50),
	"app_state" varchar(50),
	"battery_level" numeric(5, 2),
	"is_charging" boolean,
	"network_status" varchar(50),
	"ip_address" varchar(45),
	"site_name" varchar(255),
	"check_in_time" timestamp(6) with time zone,
	"check_out_time" timestamp(6) with time zone,
	"total_distance_travelled" numeric(10, 3),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"dest_lat" numeric(10, 7),
	"dest_lng" numeric(10, 7),
	"is_active" boolean DEFAULT true NOT NULL,
	"journey_id" text,
	"site_id" uuid,
	"dealer_id" varchar(255),
	"linked_journey_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "gift_allocation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gift_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"source_user_id" integer,
	"destination_user_id" integer,
	"related_report_id" varchar(255),
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"reward_id" integer
);
--> statement-breakpoint
CREATE TABLE "daily_tasks" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"assigned_by_user_id" integer NOT NULL,
	"task_date" date NOT NULL,
	"visit_type" varchar(50) NOT NULL,
	"related_dealer_id" varchar(255),
	"site_name" varchar(255),
	"description" varchar(500),
	"status" varchar(50) DEFAULT 'Assigned' NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"pjp_id" varchar(255),
	"site_id" uuid,
	"dealer_name" varchar(255),
	"dealer_category" varchar(50),
	"pjp_cycle" varchar(50),
	"related_verified_dealer_id" integer
);
--> statement-breakpoint
CREATE TABLE "dealers" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" varchar(50) NOT NULL,
	"parent_dealer_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"region" varchar(100) NOT NULL,
	"area" varchar(255) NOT NULL,
	"phone_no" varchar(20) NOT NULL,
	"address" varchar(500) NOT NULL,
	"total_potential" numeric(10, 2) NOT NULL,
	"best_potential" numeric(10, 2) NOT NULL,
	"brand_selling" text[],
	"feedbacks" varchar(500) NOT NULL,
	"remarks" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"pinCode" varchar(20),
	"dateOfBirth" date,
	"anniversaryDate" date,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"verification_status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"whatsapp_no" varchar(20),
	"email_id" varchar(255),
	"business_type" varchar(100),
	"gstin_no" varchar(20),
	"pan_no" varchar(20),
	"trade_lic_no" varchar(150),
	"aadhar_no" varchar(20),
	"godown_size_sqft" integer,
	"godown_capacity_mt_bags" varchar(500),
	"godown_address_line" varchar(500),
	"godown_landmark" varchar(255),
	"godown_district" varchar(100),
	"godown_area" varchar(255),
	"godown_region" varchar(100),
	"godown_pincode" varchar(20),
	"residential_address_line" varchar(500),
	"residential_landmark" varchar(255),
	"residential_district" varchar(100),
	"residential_area" varchar(255),
	"residential_region" varchar(100),
	"residential_pincode" varchar(20),
	"bank_account_name" varchar(255),
	"bank_name" varchar(255),
	"bank_branch_address" varchar(500),
	"bank_account_number" varchar(50),
	"bank_ifsc_code" varchar(50),
	"brand_name" varchar(255),
	"monthly_sale_mt" numeric(10, 2),
	"no_of_dealers" integer,
	"area_covered" varchar(255),
	"projected_monthly_sales_best_cement_mt" numeric(10, 2),
	"no_of_employees_in_sales" integer,
	"declaration_name" varchar(255),
	"declaration_place" varchar(100),
	"declaration_date" date,
	"trade_licence_pic_url" varchar(500),
	"shop_pic_url" varchar(500),
	"dealer_pic_url" varchar(500),
	"blank_cheque_pic_url" varchar(500),
	"partnership_deed_pic_url" varchar(500),
	"dealerdevelopmentstatus" varchar(50),
	"dealerdevelopmentobstacle" varchar(500),
	"sales_growth_percentage" numeric(5, 2),
	"no_of_pjp" integer,
	"nameOfFirm" varchar(500),
	"underSalesPromoterName" varchar(200),
	CONSTRAINT "dealers_gstin_no_unique" UNIQUE("gstin_no")
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer,
	"dealer_id" varchar(255),
	"dvr_id" varchar(255),
	"pjp_id" varchar(255),
	"order_date" date NOT NULL,
	"order_party_name" varchar(255) NOT NULL,
	"party_phone_no" varchar(20),
	"party_area" varchar(255),
	"party_region" varchar(255),
	"party_address" varchar(500),
	"delivery_date" date,
	"delivery_area" varchar(255),
	"delivery_region" varchar(255),
	"delivery_address" varchar(500),
	"delivery_loc_pincode" varchar(10),
	"payment_mode" varchar(50),
	"payment_terms" varchar(500),
	"payment_amount" numeric(12, 2),
	"received_payment" numeric(12, 2),
	"received_payment_date" date,
	"pending_payment" numeric(12, 2),
	"order_qty" numeric(12, 3),
	"order_unit" varchar(20),
	"item_price" numeric(12, 2),
	"discount_percentage" numeric(5, 2),
	"item_price_after_discount" numeric(12, 2),
	"item_type" varchar(20),
	"item_grade" varchar(10),
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now(),
	"status" varchar(50) DEFAULT 'Pending'
);
--> statement-breakpoint
CREATE TABLE "tally_raw" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_name" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"otp_code" varchar(10) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"mason_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schemes_offers" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mason_pc_side" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(100) NOT NULL,
	"phone_number" varchar(50) NOT NULL,
	"kyc_doc_name" varchar(100),
	"kyc_doc_id_num" varchar(150),
	"kyc_status" varchar(50) DEFAULT 'none',
	"bags_lifted" integer,
	"points_balance" integer DEFAULT 0,
	"is_referred" boolean,
	"referred_by_user" varchar(255),
	"referred_to_user" varchar(255),
	"dealer_id" varchar(255),
	"user_id" integer,
	"firebase_uid" varchar(128),
	"device_id" varchar(255),
	"fcm_token" varchar(500),
	CONSTRAINT "mason_pc_side_firebase_uid_key" UNIQUE("firebase_uid"),
	CONSTRAINT "mason_pc_side_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mason_id" uuid NOT NULL,
	"session_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "auth_sessions_session_token_key" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "reward_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mason_id" uuid NOT NULL,
	"reward_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'placed' NOT NULL,
	"points_debited" integer NOT NULL,
	"delivery_name" varchar(160),
	"delivery_phone" varchar(20),
	"delivery_address" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"fulfillment_notes" text
);
--> statement-breakpoint
CREATE TABLE "points_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mason_id" uuid NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"source_id" uuid,
	"points" integer NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "points_ledger_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "kyc_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mason_id" uuid NOT NULL,
	"aadhaar_number" varchar(20),
	"pan_number" varchar(20),
	"voter_id_number" varchar(20),
	"documents" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	CONSTRAINT "reward_categories_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"point_cost" integer NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"total_available_quantity" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"meta" jsonb,
	"category_id" integer,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "rewards_item_name_key" UNIQUE("item_name")
);
--> statement-breakpoint
CREATE TABLE "scheme_slabs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"min_bags_best" integer,
	"min_bags_others" integer,
	"points_earned" integer NOT NULL,
	"slab_description" varchar(255),
	"reward_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mason_slab_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mason_id" uuid NOT NULL,
	"scheme_slab_id" uuid NOT NULL,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"points_awarded" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_DealerAssociatedMasons" (
	"A" varchar(255) NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bag_lifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mason_id" uuid NOT NULL,
	"dealer_id" varchar(255),
	"purchase_date" timestamp with time zone NOT NULL,
	"bag_count" integer NOT NULL,
	"points_credited" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"image_url" text,
	"site_id" uuid,
	"site_key_person_name" varchar(255),
	"site_key_person_phone" varchar(20),
	"verification_site_image_url" text,
	"verification_proof_image_url" text
);
--> statement-breakpoint
CREATE TABLE "technical_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_name" varchar(255) NOT NULL,
	"concerned_person" varchar(255) NOT NULL,
	"phone_no" varchar(20) NOT NULL,
	"address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"site_type" varchar(50),
	"area" varchar(100),
	"region" varchar(100),
	"key_person_name" varchar(255),
	"key_person_phone_num" varchar(20),
	"stage_of_construction" varchar(100),
	"construction_start_date" date,
	"construction_end_date" date,
	"converted_site" boolean DEFAULT false,
	"first_visit_date" date,
	"last_visit_date" date,
	"need_follow_up" boolean DEFAULT false,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "_SiteAssociatedDealers" (
	"A" varchar(255) NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_SiteAssociatedMasons" (
	"A" uuid NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_SiteAssociatedUsers" (
	"A" uuid NOT NULL,
	"B" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aoi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"center_lat" double precision NOT NULL,
	"center_lon" double precision NOT NULL,
	"radius_km" double precision NOT NULL,
	"boundary_geojson" jsonb,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aoi_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "aoi_grid_cell" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aoi_id" uuid NOT NULL,
	"cell_row" integer NOT NULL,
	"cell_col" integer NOT NULL,
	"centroid_lat" double precision NOT NULL,
	"centroid_lon" double precision NOT NULL,
	"geometry_geojson" jsonb NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aoi_grid_cell_aoi_id_cell_row_cell_col_key" UNIQUE("aoi_id","cell_row","cell_col")
);
--> statement-breakpoint
CREATE TABLE "satellite_scene" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aoi_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"stac_id" text NOT NULL,
	"stac_collection" text NOT NULL,
	"acquisition_datetime" timestamp(6) with time zone NOT NULL,
	"cloud_cover_percent" double precision,
	"bbox_min_lon" double precision NOT NULL,
	"bbox_min_lat" double precision NOT NULL,
	"bbox_max_lon" double precision NOT NULL,
	"bbox_max_lat" double precision NOT NULL,
	"crs_epsg" integer,
	"native_resolution_m" double precision,
	"r2_bucket" text NOT NULL,
	"r2_prefix" text NOT NULL,
	"red_band_key" text NOT NULL,
	"nir_band_key" text NOT NULL,
	"green_band_key" text,
	"blue_band_key" text,
	"rgb_preview_key" text,
	"stac_properties" jsonb,
	"stac_assets" jsonb,
	"is_downloaded" boolean DEFAULT false NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"is_deleted_from_r2" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grid_change_score" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aoi_id" uuid NOT NULL,
	"grid_cell_id" uuid NOT NULL,
	"earlier_scene_id" uuid NOT NULL,
	"later_scene_id" uuid NOT NULL,
	"t0_acquisition_datetime" timestamp(6) with time zone NOT NULL,
	"t1_acquisition_datetime" timestamp(6) with time zone NOT NULL,
	"ndvi_drop_mean" double precision,
	"ndvi_drop_fraction" double precision,
	"change_score" double precision,
	"is_hot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tso_visit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"visited_at" timestamp(6) with time zone NOT NULL,
	"visit_outcome" text NOT NULL,
	"comments" text,
	"photo_urls" text[],
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"tso_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "highres_scene" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aoi_id" uuid NOT NULL,
	"grid_cell_id" uuid,
	"provider" text NOT NULL,
	"acquisition_datetime" timestamp(6) with time zone NOT NULL,
	"resolution_m" double precision NOT NULL,
	"bbox_min_lon" double precision NOT NULL,
	"bbox_min_lat" double precision NOT NULL,
	"bbox_max_lon" double precision NOT NULL,
	"bbox_max_lat" double precision NOT NULL,
	"r2_bucket" text NOT NULL,
	"r2_key" text NOT NULL,
	"raw_metadata_json" jsonb,
	"is_downloaded" boolean DEFAULT false NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detected_building" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"highres_scene_id" uuid NOT NULL,
	"aoi_id" uuid NOT NULL,
	"grid_cell_id" uuid,
	"centroid_lat" double precision NOT NULL,
	"centroid_lon" double precision NOT NULL,
	"footprint_geojson" jsonb NOT NULL,
	"area_sq_m" double precision NOT NULL,
	"detection_confidence" double precision,
	"status" text DEFAULT 'auto_detected' NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "construction_site" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aoi_id" uuid NOT NULL,
	"grid_cell_id" uuid,
	"source_type" text NOT NULL,
	"source_building_id" uuid,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"geom_geojson" jsonb,
	"estimated_area_sq_m" double precision,
	"first_seen_date" date NOT NULL,
	"last_seen_date" date NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"verified_by_tso_id" uuid,
	"verified_at" timestamp(6) with time zone,
	"linked_dealer_id" uuid,
	"notes" text,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"reference_id" varchar(255),
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_SchemeToRewards" (
	"A" integer NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_ops" (
	"server_seq" bigserial PRIMARY KEY NOT NULL,
	"op_id" uuid NOT NULL,
	"journey_id" varchar(255) NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journey_ops_op_id_key" UNIQUE("op_id")
);
--> statement-breakpoint
CREATE TABLE "tso_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(100),
	"date" date,
	"participants_count" integer,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now(),
	"site_id" uuid,
	"zone" varchar(100),
	"market" varchar(100),
	"dealer_name" varchar(255),
	"dealer_address" varchar(500),
	"conducted_by" varchar(255),
	"gift_type" varchar(255),
	"account_jsb_jud" varchar(100),
	"total_expenses" numeric(12, 2),
	"bill_submitted" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_server_seq" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "one_row_only" CHECK (id = 1)
);
--> statement-breakpoint
CREATE TABLE "journey_breadcrumbs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"journey_id" varchar(255) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"h3_index" varchar(15),
	"speed" real,
	"accuracy" real,
	"heading" real,
	"altitude" real,
	"battery_level" real,
	"is_charging" boolean,
	"network_status" varchar(50),
	"is_mocked" boolean DEFAULT false,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"is_synced" boolean DEFAULT false,
	"total_distance" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logistics_io" (
	"id" text PRIMARY KEY NOT NULL,
	"zone" varchar(255),
	"district" varchar(255),
	"destination" varchar(255),
	"doOrderDate" date,
	"doOrderTime" varchar(50),
	"gateInDate" date,
	"gateInTime" varchar(50),
	"processingTime" varchar(100),
	"wbInDate" date,
	"wbInTime" varchar(50),
	"diffGateInTareWt" varchar(100),
	"wbOutDate" date,
	"wbOutTime" varchar(50),
	"diffTareWtGrossWt" varchar(100),
	"gateOutDate" date,
	"gateOutTime" varchar(50),
	"diffGrossWtGateOut" varchar(100),
	"diffGrossWtInvoiceDT" varchar(100),
	"diffInvoiceDTGateOut" varchar(100),
	"diffGateInGateOut" varchar(100),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"purpose" varchar(255),
	"type_of_materials" varchar(255),
	"vehicle_number" varchar(100),
	"store_date" date,
	"store_time" varchar(50),
	"no_of_invoice" integer,
	"party_name" varchar(255),
	"invoice_nos" text[],
	"bill_nos" text[],
	"gate_out_no_of_invoice" integer,
	"gate_out_invoice_nos" text[],
	"gate_out_bill_nos" text[]
);
--> statement-breakpoint
CREATE TABLE "journeys" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"pjp_id" varchar(255),
	"site_id" varchar(255),
	"dealer_id" varchar(255),
	"site_name" varchar(255),
	"dest_lat" numeric(10, 7),
	"dest_lng" numeric(10, 7),
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"is_active" boolean DEFAULT true,
	"start_time" timestamp with time zone DEFAULT now() NOT NULL,
	"end_time" timestamp with time zone,
	"total_distance" numeric(10, 3) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_synced" boolean DEFAULT false,
	"task_id" varchar(255),
	"verified_dealer_id" integer
);
--> statement-breakpoint
CREATE TABLE "projection_vs_actual_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"institution" varchar(10) NOT NULL,
	"zone" varchar(120) NOT NULL,
	"dealer_name" varchar(255) NOT NULL,
	"order_projection_mt" numeric(12, 2),
	"actual_order_received_mt" numeric(12, 2),
	"do_done_mt" numeric(12, 2),
	"projection_vs_actual_order_mt" numeric(12, 2),
	"actual_order_vs_do_mt" numeric(12, 2),
	"collection_projection" numeric(14, 2),
	"actual_collection" numeric(14, 2),
	"short_fall" numeric(14, 2),
	"percent" numeric(6, 2),
	"source_message_id" text,
	"source_file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_dealer_id" integer,
	"user_id" integer
);
--> statement-breakpoint
CREATE TABLE "collection_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution" varchar(10) NOT NULL,
	"voucher_no" varchar(100) NOT NULL,
	"voucher_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"bank_account" varchar(255),
	"remarks" varchar(500),
	"party_name" varchar(255) NOT NULL,
	"sales_promoter_name" varchar(255),
	"zone" varchar(100),
	"district" varchar(100),
	"sales_promoter_user_id" integer,
	"source_message_id" text,
	"source_file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_dealer_id" integer,
	"user_id" integer,
	"email_report_id" uuid
);
--> statement-breakpoint
CREATE TABLE "projection_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution" varchar(10) NOT NULL,
	"report_date" date NOT NULL,
	"zone" varchar(100) NOT NULL,
	"order_dealer_name" varchar(255),
	"order_qty_mt" numeric(10, 2),
	"collection_dealer_name" varchar(255),
	"collection_amount" numeric(14, 2),
	"sales_promoter_user_id" integer,
	"source_message_id" text,
	"source_file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_dealer_id" integer,
	"user_id" integer,
	"email_report_id" uuid,
	CONSTRAINT "projection_reports_unique_key" UNIQUE("institution","report_date","zone","order_dealer_name","collection_dealer_name")
);
--> statement-breakpoint
CREATE TABLE "dealer_trend_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" integer NOT NULL,
	"cycle_date" date NOT NULL,
	"outstanding_delta" numeric(18, 2),
	"collection_delta" numeric(18, 2),
	"moving_avg_outstanding" numeric(18, 2),
	"volatility_index" numeric(8, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verified_dealers" (
	"id" serial PRIMARY KEY NOT NULL,
	"dealer_code" varchar(255),
	"dealer_party_name" varchar(255),
	"contact_no1" varchar(20),
	"contact_no2" varchar(20),
	"email" varchar(255),
	"address" text,
	"pin_code" varchar(20),
	"owner_proprietor_name" varchar(255),
	"nature_of_firm" varchar(255),
	"gst_no" varchar(50),
	"pan_no" varchar(50),
	"dealer_category" varchar(255),
	"is_subdealer" boolean,
	"user_id" integer,
	"dealer_id" varchar(255),
	"credit_limit" numeric(14, 2),
	"credit_days_allowed" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_promoters" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"employee_code" varchar(100),
	"designation" varchar(100),
	"target_monthly_collection" numeric(14, 2),
	"target_monthly_sales_mt" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"subject" text,
	"sender" text,
	"file_name" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"institution" text,
	"dealer_names" jsonb,
	"payload_hash" text DEFAULT '' NOT NULL,
	"fingerprint" text DEFAULT '' NOT NULL,
	"schema_version" integer DEFAULT 1,
	"report_type" text,
	"cycle_date" date,
	"version" integer DEFAULT 1,
	"is_latest_version" boolean DEFAULT true,
	"sheet_count" integer,
	"numeric_ratio" numeric(5, 4),
	"has_ageing_pattern" boolean,
	"has_date_pattern" boolean,
	"processing_stage" text DEFAULT 'INGESTED'
);
--> statement-breakpoint
CREATE TABLE "outstanding_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"security_deposit_amt" numeric(14, 2),
	"pending_amt" numeric(14, 2),
	"less_than_10_days" numeric(14, 2),
	"10_to_15_days" numeric(14, 2),
	"15_to_21_days" numeric(14, 2),
	"21_to_30_days" numeric(14, 2),
	"30_to_45_days" numeric(14, 2),
	"45_to_60_days" numeric(14, 2),
	"60_to_75_days" numeric(14, 2),
	"75_to_90_days" numeric(14, 2),
	"greater_than_90_days" numeric(14, 2),
	"is_overdue" boolean DEFAULT false,
	"is_account_jsb_jud" boolean DEFAULT false,
	"verified_dealer_id" integer,
	"collection_report_id" uuid,
	"dvr_id" varchar(255),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"report_date" date,
	"temp_dealer_name" text,
	"email_report_id" uuid,
	"institution" varchar(10) DEFAULT 'UNKNOWN' NOT NULL,
	CONSTRAINT "unique_outstanding_entry" UNIQUE("is_account_jsb_jud","verified_dealer_id","report_date")
);
--> statement-breakpoint
CREATE TABLE "dealer_financial_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" integer NOT NULL,
	"cycle_date" date NOT NULL,
	"total_outstanding" numeric(18, 2),
	"total_overdue" numeric(18, 2),
	"overdue_ratio" numeric(5, 4),
	"total_collection" numeric(18, 2),
	"projected_order_qty" numeric(18, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealer_intelligence_snapshot" (
	"dealer_id" integer NOT NULL,
	"current_outstanding" numeric(18, 2),
	"current_overdue" numeric(18, 2),
	"current_collection" numeric(18, 2),
	"risk_score" numeric(5, 2),
	"risk_category" text,
	"health_indicator" text,
	"last_cycle_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "masons_on_meetings" (
	"mason_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"attended_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "masons_on_meetings_pkey" PRIMARY KEY("mason_id","meeting_id")
);
--> statement-breakpoint
CREATE TABLE "mason_on_scheme" (
	"mason_id" uuid NOT NULL,
	"scheme_id" uuid NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"status" varchar(50),
	"site_id" uuid,
	CONSTRAINT "mason_on_scheme_pkey" PRIMARY KEY("mason_id","scheme_id")
);
--> statement-breakpoint
ALTER TABLE "dealer_reports_and_scores" ADD CONSTRAINT "dealer_reports_and_scores_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD CONSTRAINT "technical_visit_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD CONSTRAINT "fk_technical_visit_reports_pjp_id" FOREIGN KEY ("pjp_id") REFERENCES "public"."permanent_journey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD CONSTRAINT "technical_visit_reports_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."technical_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_reports_to_id_fkey" FOREIGN KEY ("reports_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "dealer_brand_mapping" ADD CONSTRAINT "dealer_brand_mapping_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_brand_mapping" ADD CONSTRAINT "dealer_brand_mapping_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "dealer_brand_mapping" ADD CONSTRAINT "dealer_brand_mapping_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "dealer_brand_mapping" ADD CONSTRAINT "fk_dbm_verified_dealer" FOREIGN KEY ("verified_dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "fk_dvr_dealer_id" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "fk_dvr_sub_dealer_id" FOREIGN KEY ("sub_dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "fk_daily_visit_reports_pjp_id" FOREIGN KEY ("pjp_id") REFERENCES "public"."permanent_journey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD CONSTRAINT "fk_pjp_dealer_id" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."technical_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salesman_leave_applications" ADD CONSTRAINT "salesman_leave_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salesman_attendance" ADD CONSTRAINT "salesman_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "competition_reports" ADD CONSTRAINT "competition_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "geo_tracking" ADD CONSTRAINT "geo_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "geo_tracking" ADD CONSTRAINT "geo_tracking_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."technical_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_tracking" ADD CONSTRAINT "geo_tracking_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "geo_tracking" ADD CONSTRAINT "geo_tracking_linked_journey_id_fkey" FOREIGN KEY ("linked_journey_id") REFERENCES "public"."journeys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_allocation_logs" ADD CONSTRAINT "fk_gift_logs_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_allocation_logs" ADD CONSTRAINT "fk_gift_logs_source_user" FOREIGN KEY ("source_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_allocation_logs" ADD CONSTRAINT "fk_gift_logs_dest_user" FOREIGN KEY ("destination_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_allocation_logs" ADD CONSTRAINT "fk_gift_allocation_logs_reward_id" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_related_dealer_id_fkey" FOREIGN KEY ("related_dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_pjp_id_fkey" FOREIGN KEY ("pjp_id") REFERENCES "public"."permanent_journey_plans"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."technical_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_related_verified_dealer_id_fkey" FOREIGN KEY ("related_verified_dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_parent_dealer_id_fkey" FOREIGN KEY ("parent_dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "fk_sales_orders_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "fk_sales_orders_dealer" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "fk_sales_orders_dvr" FOREIGN KEY ("dvr_id") REFERENCES "public"."daily_visit_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "fk_sales_orders_pjp" FOREIGN KEY ("pjp_id") REFERENCES "public"."permanent_journey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_verifications" ADD CONSTRAINT "fk_otp_mason" FOREIGN KEY ("mason_id") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mason_pc_side" ADD CONSTRAINT "fk_mason_dealer" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mason_pc_side" ADD CONSTRAINT "fk_mason_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_mason_id_fkey" FOREIGN KEY ("mason_id") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "fk_reward_redemptions_mason_id" FOREIGN KEY ("mason_id") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "fk_reward_redemptions_reward_id" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "fk_points_ledger_mason_id" FOREIGN KEY ("mason_id") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "fk_kyc_submissions_mason_id" FOREIGN KEY ("mason_id") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "fk_rewards_category_id" FOREIGN KEY ("category_id") REFERENCES "public"."reward_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheme_slabs" ADD CONSTRAINT "scheme_slabs_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheme_slabs" ADD CONSTRAINT "scheme_slabs_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mason_slab_achievements" ADD CONSTRAINT "mason_slab_achievements_mason_id_fkey" FOREIGN KEY ("mason_id") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mason_slab_achievements" ADD CONSTRAINT "mason_slab_achievements_scheme_slab_id_fkey" FOREIGN KEY ("scheme_slab_id") REFERENCES "public"."scheme_slabs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_DealerAssociatedMasons" ADD CONSTRAINT "_DealerAssociatedMasons_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."dealers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_DealerAssociatedMasons" ADD CONSTRAINT "_DealerAssociatedMasons_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bag_lifts" ADD CONSTRAINT "fk_bag_lifts_mason_id" FOREIGN KEY ("mason_id") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bag_lifts" ADD CONSTRAINT "fk_bag_lifts_dealer_id" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bag_lifts" ADD CONSTRAINT "fk_bag_lifts_approved_by" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bag_lifts" ADD CONSTRAINT "bag_lifts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."technical_sites"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedDealers" ADD CONSTRAINT "_SiteAssociatedDealers_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."dealers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedDealers" ADD CONSTRAINT "_SiteAssociatedDealers_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."technical_sites"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedMasons" ADD CONSTRAINT "_SiteAssociatedMasons_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedMasons" ADD CONSTRAINT "_SiteAssociatedMasons_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."technical_sites"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedUsers" ADD CONSTRAINT "_SiteAssociatedUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."technical_sites"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedUsers" ADD CONSTRAINT "_SiteAssociatedUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aoi_grid_cell" ADD CONSTRAINT "aoi_grid_cell_aoi_id_fkey" FOREIGN KEY ("aoi_id") REFERENCES "public"."aoi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satellite_scene" ADD CONSTRAINT "satellite_scene_aoi_id_fkey" FOREIGN KEY ("aoi_id") REFERENCES "public"."aoi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_change_score" ADD CONSTRAINT "grid_change_score_aoi_id_fkey" FOREIGN KEY ("aoi_id") REFERENCES "public"."aoi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_change_score" ADD CONSTRAINT "grid_change_score_grid_cell_id_fkey" FOREIGN KEY ("grid_cell_id") REFERENCES "public"."aoi_grid_cell"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_change_score" ADD CONSTRAINT "grid_change_score_earlier_scene_id_fkey" FOREIGN KEY ("earlier_scene_id") REFERENCES "public"."satellite_scene"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_change_score" ADD CONSTRAINT "grid_change_score_later_scene_id_fkey" FOREIGN KEY ("later_scene_id") REFERENCES "public"."satellite_scene"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tso_visit" ADD CONSTRAINT "tso_visit_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."construction_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highres_scene" ADD CONSTRAINT "highres_scene_aoi_id_fkey" FOREIGN KEY ("aoi_id") REFERENCES "public"."aoi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highres_scene" ADD CONSTRAINT "highres_scene_grid_cell_id_fkey" FOREIGN KEY ("grid_cell_id") REFERENCES "public"."aoi_grid_cell"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_building" ADD CONSTRAINT "detected_building_highres_scene_id_fkey" FOREIGN KEY ("highres_scene_id") REFERENCES "public"."highres_scene"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_building" ADD CONSTRAINT "detected_building_aoi_id_fkey" FOREIGN KEY ("aoi_id") REFERENCES "public"."aoi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_building" ADD CONSTRAINT "detected_building_grid_cell_id_fkey" FOREIGN KEY ("grid_cell_id") REFERENCES "public"."aoi_grid_cell"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_site" ADD CONSTRAINT "construction_site_aoi_id_fkey" FOREIGN KEY ("aoi_id") REFERENCES "public"."aoi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_site" ADD CONSTRAINT "construction_site_grid_cell_id_fkey" FOREIGN KEY ("grid_cell_id") REFERENCES "public"."aoi_grid_cell"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_site" ADD CONSTRAINT "construction_site_source_building_id_fkey" FOREIGN KEY ("source_building_id") REFERENCES "public"."detected_building"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_SchemeToRewards" ADD CONSTRAINT "_SchemeToRewards_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."rewards"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SchemeToRewards" ADD CONSTRAINT "_SchemeToRewards_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."schemes_offers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journey_ops" ADD CONSTRAINT "fk_journey_ops_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tso_meetings" ADD CONSTRAINT "fk_tso_meetings_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tso_meetings" ADD CONSTRAINT "tso_meetings_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."technical_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_breadcrumbs" ADD CONSTRAINT "journey_breadcrumbs_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_vs_actual_reports" ADD CONSTRAINT "projection_vs_actual_reports_verified_dealer_id_fkey" FOREIGN KEY ("verified_dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_vs_actual_reports" ADD CONSTRAINT "projection_vs_actual_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_reports" ADD CONSTRAINT "collection_reports_sales_promoter_user_id_fkey" FOREIGN KEY ("sales_promoter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_reports" ADD CONSTRAINT "collection_reports_verified_dealer_id_fkey" FOREIGN KEY ("verified_dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_reports" ADD CONSTRAINT "collection_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_reports" ADD CONSTRAINT "fk_collection_email_report" FOREIGN KEY ("email_report_id") REFERENCES "public"."email_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_reports" ADD CONSTRAINT "projection_reports_verified_dealer_id_fkey" FOREIGN KEY ("verified_dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_reports" ADD CONSTRAINT "projection_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_reports" ADD CONSTRAINT "fk_projection_email_report" FOREIGN KEY ("email_report_id") REFERENCES "public"."email_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_trend_metrics" ADD CONSTRAINT "dealer_trend_metrics_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD CONSTRAINT "fk_verified_dealers_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD CONSTRAINT "fk_verified_dealers_dealer_id" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_promoters" ADD CONSTRAINT "sales_promoters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outstanding_reports" ADD CONSTRAINT "fk_outstanding_verified_dealer" FOREIGN KEY ("verified_dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outstanding_reports" ADD CONSTRAINT "fk_outstanding_collection_report" FOREIGN KEY ("collection_report_id") REFERENCES "public"."collection_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outstanding_reports" ADD CONSTRAINT "fk_outstanding_dvr" FOREIGN KEY ("dvr_id") REFERENCES "public"."daily_visit_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outstanding_reports" ADD CONSTRAINT "fk_outstanding_email_report" FOREIGN KEY ("email_report_id") REFERENCES "public"."email_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_financial_snapshot" ADD CONSTRAINT "dealer_financial_snapshot_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_intelligence_snapshot" ADD CONSTRAINT "dealer_intelligence_snapshot_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "masons_on_meetings" ADD CONSTRAINT "fk_mom_mason" FOREIGN KEY ("mason_id") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "masons_on_meetings" ADD CONSTRAINT "fk_mom_meeting" FOREIGN KEY ("meeting_id") REFERENCES "public"."tso_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mason_on_scheme" ADD CONSTRAINT "fk_mos_mason" FOREIGN KEY ("mason_id") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mason_on_scheme" ADD CONSTRAINT "fk_mos_scheme" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes_offers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mason_on_scheme" ADD CONSTRAINT "mason_on_scheme_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."technical_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dealer_reports_and_scores_dealer_id_key" ON "dealer_reports_and_scores" USING btree ("dealer_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_technical_visit_reports_meeting_id" ON "technical_visit_reports" USING btree ("meeting_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_technical_visit_reports_pjp_id" ON "technical_visit_reports" USING btree ("pjp_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_technical_visit_reports_user_id" ON "technical_visit_reports" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_tvr_journey_id" ON "technical_visit_reports" USING btree ("journey_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_tvr_site_id" ON "technical_visit_reports" USING btree ("site_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_company_id" ON "users" USING btree ("company_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_user_device_id" ON "users" USING btree ("device_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_workos_user_id" ON "users" USING btree ("workos_user_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_company_id_email_key" ON "users" USING btree ("company_id" int4_ops,"email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_inviteToken_key" ON "users" USING btree ("inviteToken" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_salesman_login_id_key" ON "users" USING btree ("salesman_login_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_workos_user_id_key" ON "users" USING btree ("workos_user_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "dealer_brand_mapping_dealer_id_brand_id_key" ON "dealer_brand_mapping" USING btree ("dealer_id" text_ops,"brand_id" int4_ops);--> statement-breakpoint
CREATE INDEX "dealer_brand_mapping_user_id_idx" ON "dealer_brand_mapping" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_dbm_verified_dealer_id" ON "dealer_brand_mapping" USING btree ("verified_dealer_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "brands_brand_name_key" ON "brands" USING btree ("brand_name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_daily_visit_reports_pjp_id" ON "daily_visit_reports" USING btree ("pjp_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_daily_visit_reports_user_id" ON "daily_visit_reports" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_dvr_dealer_id" ON "daily_visit_reports" USING btree ("dealer_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_dvr_sub_dealer_id" ON "daily_visit_reports" USING btree ("sub_dealer_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_permanent_journey_plans_created_by_id" ON "permanent_journey_plans" USING btree ("created_by_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_permanent_journey_plans_user_id" ON "permanent_journey_plans" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_pjp_bulk_op_id" ON "permanent_journey_plans" USING btree ("bulk_op_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_pjp_dealer_id" ON "permanent_journey_plans" USING btree ("dealer_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_pjp_site_id" ON "permanent_journey_plans" USING btree ("site_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_pjp_idempotency_key_not_null" ON "permanent_journey_plans" USING btree ("idempotency_key" text_ops) WHERE (idempotency_key IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_pjp_user_dealer_plan_date" ON "permanent_journey_plans" USING btree ("user_id" date_ops,"dealer_id" text_ops,"plan_date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "companies_admin_user_id_key" ON "companies" USING btree ("admin_user_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "companies_workos_organization_id_key" ON "companies" USING btree ("workos_organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_admin_user_id" ON "companies" USING btree ("admin_user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_salesman_leave_applications_user_id" ON "salesman_leave_applications" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_salesman_attendance_user_id" ON "salesman_attendance" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "competition_reports_user_id_idx" ON "competition_reports" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_geo_active" ON "geo_tracking" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_geo_dealer_id" ON "geo_tracking" USING btree ("dealer_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_geo_journey_time" ON "geo_tracking" USING btree ("journey_id" timestamptz_ops,"recorded_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_geo_linked_journey_time" ON "geo_tracking" USING btree ("linked_journey_id" timestamptz_ops,"recorded_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_geo_site_id" ON "geo_tracking" USING btree ("site_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_geo_tracking_recorded_at" ON "geo_tracking" USING btree ("recorded_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_geo_tracking_user_id" ON "geo_tracking" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_geo_user_time" ON "geo_tracking" USING btree ("user_id" timestamptz_ops,"recorded_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_gift_allocation_logs_destination_user_id" ON "gift_allocation_logs" USING btree ("destination_user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_gift_allocation_logs_gift_id" ON "gift_allocation_logs" USING btree ("gift_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_gift_allocation_logs_source_user_id" ON "gift_allocation_logs" USING btree ("source_user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_gift_allocation_logs_user_id" ON "gift_allocation_logs" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_assigned_by_user_id" ON "daily_tasks" USING btree ("assigned_by_user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_date_user" ON "daily_tasks" USING btree ("task_date" int4_ops,"user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_pjp_id" ON "daily_tasks" USING btree ("pjp_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_related_dealer_id" ON "daily_tasks" USING btree ("related_dealer_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_related_verified_dealer_id" ON "daily_tasks" USING btree ("related_verified_dealer_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_site_id" ON "daily_tasks" USING btree ("site_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_status" ON "daily_tasks" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_task_date" ON "daily_tasks" USING btree ("task_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_user_id" ON "daily_tasks" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_dealers_parent_dealer_id" ON "dealers" USING btree ("parent_dealer_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_dealers_user_id" ON "dealers" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_sales_orders_dealer_id" ON "sales_orders" USING btree ("dealer_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_sales_orders_dvr_id" ON "sales_orders" USING btree ("dvr_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_sales_orders_order_date" ON "sales_orders" USING btree ("order_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_sales_orders_pjp_id" ON "sales_orders" USING btree ("pjp_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_sales_orders_user_id" ON "sales_orders" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_otp_verifications_mason_id" ON "otp_verifications" USING btree ("mason_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_reward_redemptions_mason_id" ON "reward_redemptions" USING btree ("mason_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_reward_redemptions_status" ON "reward_redemptions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_points_ledger_mason_id" ON "points_ledger" USING btree ("mason_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_points_ledger_source_id" ON "points_ledger" USING btree ("source_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_kyc_submissions_mason_id" ON "kyc_submissions" USING btree ("mason_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_rewards_category_id" ON "rewards" USING btree ("category_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_scheme_slabs_reward_id" ON "scheme_slabs" USING btree ("reward_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_scheme_slabs_scheme_id" ON "scheme_slabs" USING btree ("scheme_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_msa_mason_id" ON "mason_slab_achievements" USING btree ("mason_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_msa_slab_id" ON "mason_slab_achievements" USING btree ("scheme_slab_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "unique_mason_slab_claim" ON "mason_slab_achievements" USING btree ("mason_id" uuid_ops,"scheme_slab_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "_DealerAssociatedMasons_AB_unique" ON "_DealerAssociatedMasons" USING btree ("A" text_ops,"B" text_ops);--> statement-breakpoint
CREATE INDEX "_DealerAssociatedMasons_B_index" ON "_DealerAssociatedMasons" USING btree ("B" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_bag_lifts_dealer_id" ON "bag_lifts" USING btree ("dealer_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_bag_lifts_mason_id" ON "bag_lifts" USING btree ("mason_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_bag_lifts_site_id" ON "bag_lifts" USING btree ("site_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_bag_lifts_status" ON "bag_lifts" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "_SiteAssociatedDealers_AB_unique" ON "_SiteAssociatedDealers" USING btree ("A" text_ops,"B" text_ops);--> statement-breakpoint
CREATE INDEX "_SiteAssociatedDealers_B_index" ON "_SiteAssociatedDealers" USING btree ("B" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "_SiteAssociatedMasons_AB_unique" ON "_SiteAssociatedMasons" USING btree ("A" uuid_ops,"B" uuid_ops);--> statement-breakpoint
CREATE INDEX "_SiteAssociatedMasons_B_index" ON "_SiteAssociatedMasons" USING btree ("B" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "_SiteAssociatedUsers_AB_unique" ON "_SiteAssociatedUsers" USING btree ("A" int4_ops,"B" int4_ops);--> statement-breakpoint
CREATE INDEX "_SiteAssociatedUsers_B_index" ON "_SiteAssociatedUsers" USING btree ("B" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_aoi_grid_cell_aoi" ON "aoi_grid_cell" USING btree ("aoi_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sat_scene_aoi_time" ON "satellite_scene" USING btree ("aoi_id" timestamptz_ops,"acquisition_datetime" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_grid_change_aoi_cell" ON "grid_change_score" USING btree ("aoi_id" timestamptz_ops,"grid_cell_id" uuid_ops,"t1_acquisition_datetime" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tso_visit_site" ON "tso_visit" USING btree ("site_id" timestamptz_ops,"visited_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_highres_aoi_time" ON "highres_scene" USING btree ("aoi_id" timestamptz_ops,"acquisition_datetime" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_detected_building_aoi" ON "detected_building" USING btree ("aoi_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_site_aoi_status" ON "construction_site" USING btree ("aoi_id" text_ops,"status" uuid_ops,"first_seen_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "notifications" USING btree ("recipient_user_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "_SchemeToRewards_AB_unique" ON "_SchemeToRewards" USING btree ("A" int4_ops,"B" int4_ops);--> statement-breakpoint
CREATE INDEX "_SchemeToRewards_B_index" ON "_SchemeToRewards" USING btree ("B" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_journey_ops_created" ON "journey_ops" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_journey_ops_journey" ON "journey_ops" USING btree ("journey_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_journey_ops_server_seq" ON "journey_ops" USING btree ("server_seq" int8_ops);--> statement-breakpoint
CREATE INDEX "idx_journey_ops_user" ON "journey_ops" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_meeting_site_id" ON "tso_meetings" USING btree ("site_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_tso_meetings_created_by_user_id" ON "tso_meetings" USING btree ("created_by_user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_breadcrumbs_h3" ON "journey_breadcrumbs" USING btree ("h3_index" text_ops);--> statement-breakpoint
CREATE INDEX "idx_breadcrumbs_journey_time" ON "journey_breadcrumbs" USING btree ("journey_id" text_ops,"recorded_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_journeys_user_status" ON "journeys" USING btree ("user_id" int4_ops,"status" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_proj_actual_date" ON "projection_vs_actual_reports" USING btree ("report_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_proj_actual_dealer" ON "projection_vs_actual_reports" USING btree ("dealer_name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_proj_actual_institution" ON "projection_vs_actual_reports" USING btree ("institution" text_ops);--> statement-breakpoint
CREATE INDEX "idx_proj_actual_user" ON "projection_vs_actual_reports" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_proj_actual_verified_dealer" ON "projection_vs_actual_reports" USING btree ("verified_dealer_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_proj_actual_zone" ON "projection_vs_actual_reports" USING btree ("zone" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_proj_actual_snapshot" ON "projection_vs_actual_reports" USING btree ("report_date" text_ops,"dealer_name" date_ops,"institution" text_ops);--> statement-breakpoint
CREATE INDEX "idx_collection_date" ON "collection_reports" USING btree ("voucher_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_collection_email_report" ON "collection_reports" USING btree ("email_report_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_collection_institution" ON "collection_reports" USING btree ("institution" text_ops);--> statement-breakpoint
CREATE INDEX "idx_collection_user" ON "collection_reports" USING btree ("sales_promoter_user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_collection_verified_dealer" ON "collection_reports" USING btree ("verified_dealer_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_collection_voucher" ON "collection_reports" USING btree ("voucher_no" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_collection_voucher_inst" ON "collection_reports" USING btree ("voucher_no" text_ops,"institution" text_ops);--> statement-breakpoint
CREATE INDEX "idx_projection_date" ON "projection_reports" USING btree ("report_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_projection_email_report" ON "projection_reports" USING btree ("email_report_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_projection_institution" ON "projection_reports" USING btree ("institution" text_ops);--> statement-breakpoint
CREATE INDEX "idx_projection_user" ON "projection_reports" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_projection_verified_dealer" ON "projection_reports" USING btree ("verified_dealer_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_projection_zone" ON "projection_reports" USING btree ("zone" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_projection_snapshot" ON "projection_reports" USING btree ("report_date" date_ops,"order_dealer_name" text_ops,"collection_dealer_name" text_ops,"institution" date_ops);--> statement-breakpoint
CREATE INDEX "idx_trend_dealer" ON "dealer_trend_metrics" USING btree ("dealer_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_trend_snapshot" ON "dealer_trend_metrics" USING btree ("dealer_id" int4_ops,"cycle_date" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_verified_dealer_code" ON "verified_dealers" USING btree ("dealer_code" text_ops);--> statement-breakpoint
CREATE INDEX "idx_verified_dealer_fk" ON "verified_dealers" USING btree ("dealer_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_verified_user" ON "verified_dealers" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_verified_dealer_fk" ON "verified_dealers" USING btree ("dealer_id" text_ops) WHERE (dealer_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_verified_party_name" ON "verified_dealers" USING btree ("dealer_party_name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_sales_promoter_user" ON "sales_promoters" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_sales_promoter_user" ON "sales_promoters" USING btree ("user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_email_reports_message" ON "email_reports" USING btree ("message_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_email_reports_message_file" ON "email_reports" USING btree ("message_id" text_ops,"file_name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_outstanding_collection_report" ON "outstanding_reports" USING btree ("collection_report_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_outstanding_dvr" ON "outstanding_reports" USING btree ("dvr_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_outstanding_email_report" ON "outstanding_reports" USING btree ("email_report_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_outstanding_verified_dealer" ON "outstanding_reports" USING btree ("verified_dealer_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_financial_cycle" ON "dealer_financial_snapshot" USING btree ("cycle_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_financial_dealer" ON "dealer_financial_snapshot" USING btree ("dealer_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_financial_snapshot" ON "dealer_financial_snapshot" USING btree ("dealer_id" int4_ops,"cycle_date" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_intelligence_risk" ON "dealer_intelligence_snapshot" USING btree ("risk_category" text_ops);--> statement-breakpoint
CREATE INDEX "idx_mos_site_id" ON "mason_on_scheme" USING btree ("site_id" uuid_ops);--> statement-breakpoint
CREATE VIEW "public"."v_latest_positions" AS (SELECT DISTINCT ON (user_id) user_id, journey_id, latitude::double precision AS lat, longitude::double precision AS lng, recorded_at FROM geo_tracking ORDER BY user_id, recorded_at DESC);
*/