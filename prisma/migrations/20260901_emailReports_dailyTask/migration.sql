CREATE TABLE "email_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" text NOT NULL,
  "subject" text,
  "sender" text,
  "file_name" text,
  "payload" jsonb NOT NULL,
  "processed" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "idx_email_reports_message" ON "email_reports" ("message_id");

ALTER TABLE "daily_tasks"
ADD COLUMN "dealer_name" VARCHAR(255),
ADD COLUMN "dealer_category" VARCHAR(50),
ADD COLUMN "pjp_cycle" VARCHAR(50);