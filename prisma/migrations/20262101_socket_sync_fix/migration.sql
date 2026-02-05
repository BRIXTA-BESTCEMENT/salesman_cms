-- 1. Remove the "Start Journey" circular dependency
-- (This allows journey_ops to accept a journey_id before the journey table does)
ALTER TABLE journey_ops 
DROP CONSTRAINT fk_journey_ops_journey;

-- 2. Optimize Breadcrumbs for Map Performance
-- (Change from slow Numeric to fast Double Precision)
ALTER TABLE journey_breadcrumbs 
ALTER COLUMN latitude TYPE double precision,
ALTER COLUMN longitude TYPE double precision;