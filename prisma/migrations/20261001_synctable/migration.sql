CREATE TABLE "sync_state" (
  "id" INTEGER PRIMARY KEY DEFAULT 1,
  "last_server_seq" BIGINT NOT NULL DEFAULT 0,
  
  -- Constraint to ensure only one row (Singleton)
  CONSTRAINT "one_row_only" CHECK ("id" = 1)
);

-- Insert the initial row immediately so updates work later
INSERT INTO "sync_state" ("last_server_seq") VALUES (0) 
ON CONFLICT DO NOTHING;