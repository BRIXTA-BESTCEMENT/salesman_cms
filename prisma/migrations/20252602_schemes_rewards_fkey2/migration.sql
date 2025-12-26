-- 1. Drop the incorrect join table
DROP TABLE IF EXISTS "_SchemeToRewards";

-- 2. Recreate with A as Integer (Rewards) and B as UUID (SchemesOffers)
CREATE TABLE "_SchemeToRewards" (
    "A" INTEGER NOT NULL, -- References Rewards.id (R comes first)
    "B" UUID NOT NULL     -- References SchemesOffers.id (S comes second)
);

-- 3. Create indices and constraints in the correct order
CREATE UNIQUE INDEX "_SchemeToRewards_AB_unique" ON "_SchemeToRewards"("A", "B");
CREATE INDEX "_SchemeToRewards_B_index" ON "_SchemeToRewards"("B");

-- 4. Foreign Key for Rewards (Column A)
ALTER TABLE "_SchemeToRewards" 
ADD CONSTRAINT "_SchemeToRewards_A_fkey" 
FOREIGN KEY ("A") REFERENCES "rewards"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Foreign Key for SchemesOffers (Column B)
ALTER TABLE "_SchemeToRewards" 
ADD CONSTRAINT "_SchemeToRewards_B_fkey" 
FOREIGN KEY ("B") REFERENCES "schemes_offers"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;