CREATE TABLE IF NOT EXISTS "collection_reports" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
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
    "dealer_id" varchar(255),
    "sales_promoter_user_id" integer,
    "source_message_id" text,
    "source_file_name" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Constraints
ALTER TABLE "collection_reports" 
ADD CONSTRAINT "collection_reports_dealer_id_dealers_id_fk" 
FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_collection_institution" ON "collection_reports" ("institution");
CREATE INDEX IF NOT EXISTS "idx_collection_date" ON "collection_reports" ("voucher_date");
CREATE INDEX IF NOT EXISTS "idx_collection_dealer" ON "collection_reports" ("dealer_id");
CREATE INDEX IF NOT EXISTS "idx_collection_voucher" ON "collection_reports" ("voucher_no");
CREATE INDEX IF NOT EXISTS "idx_collection_user" ON "collection_reports" ("sales_promoter_user_id");


DROP TABLE IF EXISTS "sales_order_colln_proj";