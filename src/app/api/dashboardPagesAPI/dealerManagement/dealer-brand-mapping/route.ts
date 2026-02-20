// src/app/api/dashboardPagesAPI/dealerManagement/dealer-brand-mapping/route.ts
// This API route fetches and consolidates brand capacity data for dealers.
// It combines information from the Dealer, Brand, and DealerBrandMapping tables
// to create a single, comprehensive report.
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod'; // Added Zod Import
import { baseDealerBrandMappingSchema } from '@/lib/shared-zod-schema';

// We'll refine the schema later to ensure dynamic keys are numbers, but for a general check, .passthrough() is enough
export const dealerBrandMappingSchema = baseDealerBrandMappingSchema.passthrough().refine(
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
  const brands = await prisma.brand.findMany({
    where: {
      dealers: {
        some: {
          dealer: {
            user: {
              companyId: companyId,
            },
          },
        },
      },
    },
    select: {
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  });
  return brands.map((b:any) => b.name);
}

// Helper for Deciaml? fields
function toNumberOrNull(val: any): number | null {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'object' && typeof val.toNumber === 'function') {
        return val.toNumber();
    }
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
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { id: true, role: true, companyId: true } // Select only necessary fields
    });

    // 3. Role-based Authorization Check: Ensure the user's role is allowed
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Your role does not have access to this data.` }, { status: 403 });
    }

    // 4. Fetch all brands for the user's company to create dynamic columns
    const allBrands = await getAllBrandNames(currentUser.companyId);

    // 5. Fetch dealer brand mappings for the user's company, including related data.
    const brandMappings = await prisma.dealerBrandMapping.findMany({
      where: {
        dealer: {
          user: {
            companyId: currentUser.companyId,
          },
        },
      },
      include: {
        dealer: {
          select: {
            id: true,
            name: true,
            area: true,
            totalPotential: true,
          },
        },
        brand: {
          select: {
            name: true,
          },
        },
      },
    });

    // An object to hold the processed data, grouped by dealerId.
    const aggregatedData: Record<string, any> = {};

    // Process the fetched data to build the final, flat structure.
    for (const mapping of brandMappings) {
      const { dealerId, dealer, brand, capacityMT } = mapping;

      if (!aggregatedData[dealerId]) {
        aggregatedData[dealerId] = {
          id: dealer.id,
          dealerName: dealer.name,
          area: dealer.area,
          totalPotential: dealer.totalPotential.toNumber(),
          userId: mapping.userId,
          bestCapacityMT: toNumberOrNull(mapping.bestCapacityMT),
          brandGrowthCapacityPercent: toNumberOrNull(mapping.brandGrowthCapacityPercent),
        };

        // Add placeholders for all possible brands with a default value of 0.
        for (const brandName of allBrands) {
          aggregatedData[dealerId][brandName] = 0;
        }
      }

      // Add the actual brand capacity to the correct column.
      // NOTE: capacityMT is Decimal, but .toNumber() is called in aggregation
      aggregatedData[dealerId][brand.name] = capacityMT.toNumber();
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
