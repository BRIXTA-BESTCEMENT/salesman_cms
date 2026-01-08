CREATE TABLE IF NOT EXISTS "journeys" (
    "id" varchar(255) PRIMARY KEY,
    "user_id" integer NOT NULL, -- Ensure this matches your 'users' table id type
    
    -- STATIC CONTEXT
    "pjp_id" varchar(255),
    "site_id" varchar(255),
    "dealer_id" varchar(255),
    "site_name" varchar(255),
    
    -- DESTINATION
    "dest_lat" numeric(10, 7),
    "dest_lng" numeric(10, 7),
    
    -- STATE
    "status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
    "is_active" boolean DEFAULT true,
    
    -- TIMESTAMPS
    "start_time" timestamp with time zone DEFAULT now() NOT NULL,
    "end_time" timestamp with time zone,
    
    -- AGGREGATES
    "total_distance" numeric(10, 3) DEFAULT '0',
    
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,

    -- CONSTRAINT
    CONSTRAINT "journeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- INDEX
CREATE INDEX IF NOT EXISTS "idx_journeys_user_status" ON "journeys" ("user_id", "status");

CREATE TABLE IF NOT EXISTS "journey_breadcrumbs" (
    "id" varchar(255) PRIMARY KEY,
    
    -- LINK TO PARENT
    "journey_id" varchar(255) NOT NULL,
    
    -- PHYSICS
    "latitude" numeric(10, 7) NOT NULL,
    "longitude" numeric(10, 7) NOT NULL,
    
    -- H3 INDEX
    "h3_index" varchar(15),
    
    -- TELEMETRY (Using real/float4 for efficiency)
    "speed" real,
    "accuracy" real,
    "heading" real,
    "altitude" real,
    
    -- DIAGNOSTICS
    "battery_level" real,
    "is_charging" boolean,
    "network_status" varchar(50),
    "is_mocked" boolean DEFAULT false,
    
    -- TIME
    "recorded_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),

    -- CONSTRAINT
    CONSTRAINT "journey_breadcrumbs_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journeys"("id") ON DELETE CASCADE
);

-- INDEXES
CREATE INDEX IF NOT EXISTS "idx_breadcrumbs_journey_time" ON "journey_breadcrumbs" ("journey_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "idx_breadcrumbs_h3" ON "journey_breadcrumbs" ("h3_index");

-- 1. Add the column with a UNIQUE name
ALTER TABLE "geo_tracking" ADD COLUMN "linked_journey_id" varchar(255);

-- 2. Add the Foreign Key
ALTER TABLE "geo_tracking" 
ADD CONSTRAINT "geo_tracking_linked_journey_id_fkey" 
FOREIGN KEY ("linked_journey_id") REFERENCES "journeys"("id") ON DELETE SET NULL;

-- 3. Add the Index for the new column
CREATE INDEX IF NOT EXISTS "idx_geo_linked_journey_time" ON "geo_tracking" ("linked_journey_id", "recorded_at");