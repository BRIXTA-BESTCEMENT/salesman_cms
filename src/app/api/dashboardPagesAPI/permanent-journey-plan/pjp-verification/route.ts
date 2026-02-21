// src/app/api/dashboardPagesAPI/permanent-journey-plan/pjp-verification/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, permanentJourneyPlans, dealers, technicalSites } from '../../../../../../drizzle';
import { eq, and, or, asc, aliasedTable, getTableColumns } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectPermanentJourneyPlanSchema } from '../../../../../../drizzle/zodSchemas';

const allowedRoles = [
    'president',
    'senior-general-manager',
    'general-manager',
    'regional-sales-manager',
    'senior-manager',
    'manager',
    'assistant-manager',
];

const getISTDate = (date: string | Date | null) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// 1. Extend the baked DB schema to strictly type the joined fields AND the mapped old Prisma fields
const frontendPJPSchema = selectPermanentJourneyPlanSchema.extend({
    salesmanName: z.string(),
    createdByName: z.string(),
    createdByRole: z.string().nullable().optional(),
    visitDealerName: z.string().nullable().optional(),
    verificationStatus: z.string(),
    salesmanRegion: z.string().nullable().optional(),
    salesmanArea: z.string().nullable().optional(),
    planDate: z.string(), // Override because we format it strictly via getISTDate

    // Explicitly mapping the old Prisma camelCase names the frontend expects
    noOfConvertedBags: z.number().nullable().optional(),
    noOfMasonPcSchemes: z.number().nullable().optional(),
});

// 2. Explicit type to survive Next.js 'use cache' boundary collapse
type PendingPJPRow = InferSelectModel<typeof permanentJourneyPlans> & {
    salesmanFirstName: string | null;
    salesmanLastName: string | null;
    salesmanEmail: string | null;
    salesmanRegion: string | null;
    salesmanArea: string | null;
    createdByFirstName: string | null;
    createdByLastName: string | null;
    createdByEmail: string | null;
    createdByRole: string | null;
    dealerName: string | null;
    siteName: string | null;
};

// 3. The Cached Function
async function getCachedPendingPJPs(companyId: number) {
    'use cache';
    cacheLife('hours');
    cacheTag(`pjp-verification-${companyId}`);

    const createdByUsers = aliasedTable(users, 'createdByUsers');

    // Use getTableColumns and explicit typing to prevent `never[]`
    const results: PendingPJPRow[] = await db
        .select({
            ...getTableColumns(permanentJourneyPlans),
            salesmanFirstName: users.firstName,
            salesmanLastName: users.lastName,
            salesmanEmail: users.email,
            salesmanRegion: users.region,
            salesmanArea: users.area,
            createdByFirstName: createdByUsers.firstName,
            createdByLastName: createdByUsers.lastName,
            createdByEmail: createdByUsers.email,
            createdByRole: createdByUsers.role,
            dealerName: dealers.name,
            siteName: technicalSites.siteName,
        })
        .from(permanentJourneyPlans)
        .leftJoin(users, eq(permanentJourneyPlans.userId, users.id))
        .leftJoin(createdByUsers, eq(permanentJourneyPlans.createdById, createdByUsers.id))
        .leftJoin(dealers, eq(permanentJourneyPlans.dealerId, dealers.id))
        .leftJoin(technicalSites, eq(permanentJourneyPlans.siteId, technicalSites.id))
        .where(
            and(
                eq(users.companyId, companyId),
                or(
                    eq(permanentJourneyPlans.status, 'PENDING'),
                    eq(permanentJourneyPlans.verificationStatus, 'PENDING')
                )
            )
        )
        .orderBy(asc(permanentJourneyPlans.planDate));

    return results.map((row) => {
        const salesmanName = `${row.salesmanFirstName || ''} ${row.salesmanLastName || ''}`.trim() || row.salesmanEmail || '';
        const createdByName = `${row.createdByFirstName || ''} ${row.createdByLastName || ''}`.trim() || row.createdByEmail || '';
        const visitTargetName = row.dealerName ?? row.siteName ?? null;

        return {
            ...row,
            salesmanName,
            createdByName,
            createdByRole: row.createdByRole,
            planDate: getISTDate(row.planDate),
            visitDealerName: visitTargetName,
            verificationStatus: row.verificationStatus ? row.verificationStatus.toUpperCase() : 'PENDING',
            salesmanRegion: row.salesmanRegion,
            salesmanArea: row.salesmanArea,

            // FIX: Re-map Drizzle generated names back to the exact old Prisma casing!
            noOfConvertedBags: row.noofConvertedBags ?? 0,
            noOfMasonPcSchemes: row.noofMasonpcInSchemes ?? 0,
            plannedNewSiteVisits: row.plannedNewSiteVisits ?? 0,
            plannedFollowUpSiteVisits: row.plannedFollowUpSiteVisits ?? 0,
            plannedNewDealerVisits: row.plannedNewDealerVisits ?? 0,
            plannedInfluencerVisits: row.plannedInfluencerVisits ?? 0,

            createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
        };
    });
}

export async function GET(request: NextRequest) {
    if (typeof connection === 'function') await connection();
    
    try {
        const claims = await getTokenClaims();
        if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const currentUserResult = await db
            .select({ id: users.id, role: users.role, companyId: users.companyId })
            .from(users)
            .where(eq(users.workosUserId, claims.sub))
            .limit(1);

        const currentUser = currentUserResult[0];

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json(
                { error: `Forbidden: Your role (${currentUser?.role || 'None'}) is not authorized for PJP verification.` }, 
                { status: 403 }
            );
        }

        const formattedPlans = await getCachedPendingPJPs(currentUser.companyId);

        // Validate using the strictly extended schema, allowing loose pass-through if needed
        const validatedPlans = z.array(frontendPJPSchema.loose()).safeParse(formattedPlans);

        if (!validatedPlans.success) {
            console.error("GET Response Validation Error:", validatedPlans.error.format());
            // Safe fallback to prevent complete UI crash if one field mismatches
            return NextResponse.json({ plans: formattedPlans }, { status: 200 }); 
        }

        return NextResponse.json({ plans: validatedPlans.data }, { status: 200 });
    } catch (error) {
        console.error('Error fetching pending PJPs (GET):', error);
        return NextResponse.json({ error: 'Failed to fetch', details: (error as Error).message }, { status: 500 });
    }
}