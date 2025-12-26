-- 1. Create the many-to-many join table
-- Standard Prisma naming convention for implicit many-to-many is _SchemeToRewards
CREATE TABLE "_SchemeToRewards" (
    "A" UUID NOT NULL,    -- References schemes_offers.id
    "B" INTEGER NOT NULL  -- References rewards.id
);

-- 2. Create a unique index to prevent duplicate mapping
CREATE UNIQUE INDEX "_SchemeToRewards_AB_unique" ON "_SchemeToRewards"("A", "B");

-- 3. Create an index on column B for faster reverse lookups (finding schemes for a reward)
CREATE INDEX "_SchemeToRewards_B_index" ON "_SchemeToRewards"("B");

-- 4. Add foreign key constraint for SchemesOffers (UUID)
ALTER TABLE "_SchemeToRewards" 
ADD CONSTRAINT "_SchemeToRewards_A_fkey" 
FOREIGN KEY ("A") REFERENCES "schemes_offers"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Add foreign key constraint for Rewards (Integer)
ALTER TABLE "_SchemeToRewards" 
ADD CONSTRAINT "_SchemeToRewards_B_fkey" 
FOREIGN KEY ("B") REFERENCES "rewards"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;