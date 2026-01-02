ALTER TABLE technical_visit_reports 
ADD COLUMN journey_id VARCHAR(255);

-- 2. Add an index for performance
CREATE INDEX idx_tvr_journey_id ON technical_visit_reports(journey_id);