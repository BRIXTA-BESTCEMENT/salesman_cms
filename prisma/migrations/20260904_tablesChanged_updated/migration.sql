CREATE TABLE journey_ops (
  server_seq BIGSERIAL PRIMARY KEY,
  op_id UUID NOT NULL UNIQUE,
  journey_id UUID NOT NULL,
  user_id INT NOT NULL,
  type TEXT NOT NULL,              -- START | MOVE | STOP
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journey_ops_journey
  ON journey_ops (journey_id);

CREATE INDEX idx_journey_ops_user
  ON journey_ops (user_id);

CREATE INDEX idx_journey_ops_created
  ON journey_ops (created_at);

ALTER TABLE "journey_ops"
ALTER COLUMN "journey_id" TYPE VARCHAR(255);

ALTER TABLE "journey_ops"
ADD CONSTRAINT "fk_journey_ops_user"
FOREIGN KEY ("user_id")
REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "journey_ops"
ADD CONSTRAINT "fk_journey_ops_journey"
FOREIGN KEY ("journey_id")
REFERENCES "journeys"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;