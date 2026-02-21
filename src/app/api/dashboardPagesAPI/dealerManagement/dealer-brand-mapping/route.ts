// src/app/api/dashboardPagesAPI/dealerManagement/dealer-brand-mapping/route.ts
// This API route fetches and consolidates brand capacity data for dealers.
// It combines information from the Dealer, Brand, and DealerBrandMapping tables
// to create a single, comprehensive report.
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, dealers, brands, dealerBrandMapping } from '../../../../../../drizzle'; 
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { selectDealerBrandMappingSchema } from '../../../../../../drizzle/zodSchemas';

export const dealerBrandMappingSchema = selectDealerBrandMappingSchema.loose().refine(
  (data) => {
    // Custom check: ensure all extra properties (brand capacities) are non-negative numbers
    for (const key in data) {
      if (
        !['id', 'dealerName', 'area', 'totalPotential'].includes(key) &&
        (typeof data[key] !== 'number' || data[key] < 0)
      ) {
        return false;
      }
    }
    return true;
  },
  {
    message: "Dynamic brand capacity fields must be non-negative numbers.",
    path: ['dynamic_brand_fields'],
  }
);
// -------------------------------------------------

// A list of roles that are allowed to access this endpoint.
const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive','executive'];

// Helper function to fetch all unique brand names for a given company.
async function getAllBrandNames(companyId: number) {
  // Using explicit joins to replicate Prisma's nested "some" filter
  const brandsData = await db
    .selectDistinct({ name: brands.brandName })
    .from(brands)
    .innerJoin(dealerBrandMapping, eq(brands.id, dealerBrandMapping.brandId))
    .innerJoin(dealers, eq(dealerBrandMapping.dealerId, dealers.id))
    .innerJoin(users, eq(dealers.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(asc(brands.brandName));
    
  return brandsData.map(b => b.name);
}

// Helper for Decimal/Numeric fields (Drizzle returns these as strings by default)
function toNumberOrNull(val: any): number | null {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
}

// Main API handler for the brand mapping data.
export async function GET() {
  await connection();
  try {
    // 1. Authentication Check: Verify the user is logged in
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Current User to check their role and companyId
    const currentUserResult = await db
      .select({ id: users.id, role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);
      
    const currentUser = currentUserResult[0];

    // 3. Role-based Authorization Check: Ensure the user's role is allowed
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Your role does not have access to this data.` }, { status: 403 });
    }

    // 4. Fetch all brands for the user's company to create dynamic columns
    const allBrands = await getAllBrandNames(currentUser.companyId);

    // 5. Fetch dealer brand mappings for the user's company, including related data.
    const brandMappingsData = await db
      .select({
        mapping: dealerBrandMapping,
        dealer: {
          id: dealers.id,
          name: dealers.name,
          area: dealers.area,
          totalPotential: dealers.totalPotential,
        },
        brand: {
          name: brands.brandName,
        }
      })
      .from(dealerBrandMapping)
      .innerJoin(dealers, eq(dealerBrandMapping.dealerId, dealers.id))
      .innerJoin(brands, eq(dealerBrandMapping.brandId, brands.id))
      .innerJoin(users, eq(dealers.userId, users.id))
      .where(eq(users.companyId, currentUser.companyId));

    // An object to hold the processed data, grouped by dealerId.
    const aggregatedData: Record<string, any> = {};

    // Process the fetched data to build the final, flat structure.
    for (const row of brandMappingsData) {
      const { mapping, dealer, brand } = row;
      const dealerId = mapping.dealerId;

      if (!aggregatedData[dealerId]) {
        aggregatedData[dealerId] = {
          id: dealer.id,
          dealerName: dealer.name,
          area: dealer.area,
          totalPotential: Number(dealer.totalPotential || 0), // Convert string to number
          userId: mapping.userId,
          bestCapacityMT: toNumberOrNull(mapping.bestCapacityMt),
          brandGrowthCapacityPercent: toNumberOrNull(mapping.brandGrowthCapacityPercent),
        };

        // Add placeholders for all possible brands with a default value of 0.
        for (const brandName of allBrands) {
          aggregatedData[dealerId][brandName] = 0;
        }
      }

      // Add the actual brand capacity to the correct column.
      aggregatedData[dealerId][brand.name] = Number(mapping.capacityMt || 0);
    }

    // Convert the aggregated object back into a clean array for the frontend.
    const finalData = Object.values(aggregatedData);

    // 6. Added Zod Validation
    const validatedData = z.array(dealerBrandMappingSchema).parse(finalData);

    // Return a success response with the structured data.
    return NextResponse.json(validatedData, { status: 200 });

  } catch (error) {
    console.error('API Error:', error);
    // Return a generic error message to the client, logging the specific error internally
    return NextResponse.json(
      { error: 'Failed to fetch brand mapping data', details: (error as Error).message }, 
      { status: 500 }
    );
  }
}