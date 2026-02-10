-- 1. Table: projection_vs_actual_reports
CREATE TABLE IF NOT EXISTS "projection_vs_actual_reports" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for projection_vs_actual_reports
CREATE INDEX "idx_proj_actual_date" ON "projection_vs_actual_reports" ("report_date");
CREATE INDEX "idx_proj_actual_zone" ON "projection_vs_actual_reports" ("zone");
CREATE INDEX "idx_proj_actual_dealer" ON "projection_vs_actual_reports" ("dealer_name");
CREATE INDEX "idx_proj_actual_institution" ON "projection_vs_actual_reports" ("institution");
CREATE UNIQUE INDEX "uniq_proj_actual_snapshot" ON "projection_vs_actual_reports" ("report_date", "dealer_name", "institution");


-- 2. Table: projection_reports
CREATE TABLE IF NOT EXISTS "projection_reports" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "institution" varchar(10) NOT NULL,
    "report_date" date NOT NULL,
    "zone" varchar(100) NOT NULL,
    "order_dealer_name" varchar(255),
    "order_qty_mt" numeric(10, 2),
    "collection_dealer_name" varchar(255),
    "collection_amount" numeric(14, 2),
    "dealer_id" varchar(255),
    "sales_promoter_user_id" integer,
    "source_message_id" text,
    "source_file_name" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "projection_reports_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE SET NULL
);

-- Indexes for projection_reports
CREATE INDEX "idx_projection_date" ON "projection_reports" ("report_date");
CREATE INDEX "idx_projection_zone" ON "projection_reports" ("zone");
CREATE INDEX "idx_projection_institution" ON "projection_reports" ("institution");
CREATE INDEX "idx_projection_dealer" ON "projection_reports" ("dealer_id");