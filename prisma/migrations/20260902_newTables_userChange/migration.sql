ALTER TABLE "users" 
ADD COLUMN "is_admin_app_user" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE sales_order_colln_proj (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE,
    dealer_id VARCHAR(255),
    user_id INT,
    order_proj_in_mt NUMERIC(10, 2),
    colln_proj_in_rs NUMERIC(14, 2),
    actual_order NUMERIC(10, 2),
    do_done NUMERIC(10, 2),
    actual_collection NUMERIC(14, 2),
    shortfall_amt NUMERIC(14, 2),
    source TEXT,      -- e.g. 'ADMIN_EXCEL', 'JSB', 'JUD', 'APP'
    payload JSONB,    -- raw / extra / future-proof data
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sales_order_colln_proj
ADD CONSTRAINT fk_sales_order_colln_proj_dealer
FOREIGN KEY (dealer_id)
REFERENCES dealers(id)
ON DELETE SET NULL;

ALTER TABLE sales_order_colln_proj
ADD CONSTRAINT fk_sales_order_colln_proj_user
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE SET NULL;

-- One logical row per dealer per date
CREATE UNIQUE INDEX uniq_sales_order_colln_proj_dealer_date
ON sales_order_colln_proj (dealer_id, report_date);

-- Date based dashboards
CREATE INDEX idx_sales_order_colln_proj_report_date
ON sales_order_colln_proj (report_date);

-- Salesman based queries
CREATE INDEX idx_sales_order_colln_proj_user
ON sales_order_colln_proj (user_id);

-- Source-based filtering (JSB / JUD / ADMIN)
CREATE INDEX idx_sales_order_colln_proj_source
ON sales_order_colln_proj (source);
