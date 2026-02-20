ALTER TABLE journeys 
ADD COLUMN task_id VARCHAR(255);

-- 2. Add the Verified Dealer ID column (for verified dealers)
ALTER TABLE journeys 
ADD COLUMN verified_dealer_id INTEGER;