// src/app/api/dashboardPagesAPI/permanent-journey-plan/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, permanentJourneyPlans, dailyTasks, dealers, technicalSites } from '../../../../../drizzle';
import { eq, and, desc, aliasedTable, getTableColumns, inArray, ilike } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectPermanentJourneyPlanSchema } from '../../../../../drizzle/zodSchemas';
import { refreshCompanyCache } from '@/app/actions/cache';

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive',
];

const getISTDate = (date: string | Date | null) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// 1. Extend the baked DB schema to include frontend-specific types and joined fields
const frontendPJPSchema = selectPermanentJourneyPlanSchema.extend({
  salesmanName: z.string(),
  createdByName: z.string(),
  createdByRole: z.string().nullable().optional(),
  taskIds: z.array(z.string()), 
  visitDealerName: z.string().nullable(),
  planDate: z.string(), 
  
  // Explicitly mapping the old Prisma camelCase names the frontend expects
  noOfConvertedBags: z.number().nullable().optional(),
  noOfMasonPcSchemes: z.number().nullable().optional(),
});

// 2. Explicit type to survive Next.js 'use cache' boundary
type PJPRow = InferSelectModel<typeof permanentJourneyPlans> & {
  salesmanFirstName: string | null;
  salesmanLastName: string | null;
  salesmanEmail: string | null;
  createdByFirstName: string | null;
  createdByLastName: string | null;
  createdByEmail: string | null;
  createdByRole: string | null;
  dealerName: string | null;
  siteName: string | null;
};

async function getCachedPJPs(companyId: number, verificationStatus: string | null) {
  'use cache';
  cacheLife('days');
  cacheTag(`permanent-journey-plan-${companyId}`);

  const createdByUsers = aliasedTable(users, 'createdByUsers');

  // Build dynamic filters
  const filters = [eq(users.companyId, companyId)];
  
  // FIX: Ignore "all" or "null" strings, and use ilike for case-insensitive matching
  if (verificationStatus && verificationStatus !== 'all' && verificationStatus !== 'null') {
    filters.push(ilike(permanentJourneyPlans.verificationStatus, verificationStatus));
  }

  // 1. Fetch flat PJPs using getTableColumns
  const rawPlans: PJPRow[] = await db
    .select({
      ...getTableColumns(permanentJourneyPlans),
      salesmanFirstName: users.firstName,
      salesmanLastName: users.lastName,
      salesmanEmail: users.email,
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
    .where(and(...filters))
    .orderBy(desc(permanentJourneyPlans.planDate));

  // 2. Safely fetch tasks ONLY for these PJPs to avoid the Drizzle N+1 tautology
  const pjpIds = rawPlans.map(p => p.id);
  const tasks = pjpIds.length > 0 
    ? await db
        .select({ id: dailyTasks.id, pjpId: dailyTasks.pjpId })
        .from(dailyTasks)
        .where(inArray(dailyTasks.pjpId, pjpIds))
    : [];

  // Group tasks by pjpId for O(1) lookups
  const tasksByPjpId = tasks.reduce((acc, task) => {
    if (task.pjpId) {
        if (!acc[task.pjpId]) acc[task.pjpId] = [];
        acc[task.pjpId].push(task.id);
    }
    return acc;
  }, {} as Record<string, string[]>);

  // 3. Map to final frontend structure
  return rawPlans.map((row) => {
    const salesmanName = `${row.salesmanFirstName || ''} ${row.salesmanLastName || ''}`.trim() || row.salesmanEmail || '';
    const createdByName = `${row.createdByFirstName || ''} ${row.createdByLastName || ''}`.trim() || row.createdByEmail || '';
    
    return {
      ...row,
      salesmanName,
      createdByName,
      createdByRole: row.createdByRole,
      planDate: getISTDate(row.planDate),
      taskIds: tasksByPjpId[row.id] || [],
      visitDealerName: row.dealerName ?? row.siteName ?? null,
      
      // FIX: Re-map Drizzle generated names back to the old Prisma exact casing
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const verificationStatus = searchParams.get('verificationStatus');

    const formattedPlans = await getCachedPJPs(currentUser.companyId, verificationStatus);
    
    // Validate safely with loose() to ensure mapped frontend variables don't get stripped
    const validatedData = z.array(frontendPJPSchema.loose()).safeParse(formattedPlans);

    if (!validatedData.success) {
      console.error("PJP Validation Error:", validatedData.error.format());
      return NextResponse.json(formattedPlans, { status: 200 }); // Graceful fallback
    }

    return NextResponse.json(validatedData.data, { status: 200 });
  } catch (error) {
    console.error('Error fetching permanent journey plans:', error);
    return NextResponse.json({ error: 'Failed to fetch', details: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const pjpId = url.searchParams.get('id');
    if (!pjpId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const pjpToDeleteResult = await db
      .select({ id: permanentJourneyPlans.id, companyId: users.companyId })
      .from(permanentJourneyPlans)
      .leftJoin(users, eq(permanentJourneyPlans.userId, users.id))
      .where(eq(permanentJourneyPlans.id, pjpId))
      .limit(1);

    const pjpToDelete = pjpToDeleteResult[0];

    if (!pjpToDelete || pjpToDelete.companyId !== currentUser.companyId) {
      return NextResponse.json({ error: 'Forbidden or Not Found' }, { status: 403 });
    }

    await db.delete(permanentJourneyPlans).where(eq(permanentJourneyPlans.id, pjpId));

    await refreshCompanyCache('permanent-journey-plan');
    await refreshCompanyCache('pjp-verification');

    return NextResponse.json({ message: 'Deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting PJP:', error);
    return NextResponse.json({ error: 'Failed to delete', details: (error as Error).message }, { status: 500 });
  }
}