// src/app/api/dashboardPagesAPI/permanent-journey-plan/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, permanentJourneyPlans, dailyTasks, dealers, technicalSites } from '../../../../../drizzle';
import { eq, and, or, ilike, desc, asc, aliasedTable, getTableColumns, inArray, sql, SQL, count, gte, lte } from 'drizzle-orm';
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

const frontendPJPSchema = selectPermanentJourneyPlanSchema.extend({
  salesmanName: z.string(),
  createdByName: z.string(),
  createdByRole: z.string().nullable().optional(),
  taskIds: z.array(z.string()), 
  visitDealerName: z.string().nullable(),
  planDate: z.string(), 
  
  noOfConvertedBags: z.number().nullable().optional(),
  noOfMasonPcSchemes: z.number().nullable().optional(),
});

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

async function getCachedPJPs(
  companyId: number,
  page: number,
  pageSize: number,
  search: string | null,
  salesmanId: string | null,
  status: string | null,
  verificationStatus: string | null,
  fromDate: string | null,
  toDate: string | null
) {
  'use cache';
  cacheLife('days');
  
  const filterKey = `${search}-${salesmanId}-${status}-${verificationStatus}-${fromDate}-${toDate}`;
  cacheTag(`permanent-journey-plan-${companyId}-${page}-${filterKey}`);

  const createdByUsers = aliasedTable(users, 'createdByUsers');

  const filters: SQL[] = [eq(users.companyId, companyId)];
  
  if (verificationStatus && verificationStatus !== 'all' && verificationStatus !== 'null') {
    filters.push(ilike(permanentJourneyPlans.verificationStatus, verificationStatus));
  }

  if (search) {
    const searchCondition = or(
      ilike(users.firstName, `%${search}%`),
      ilike(users.lastName, `%${search}%`),
      ilike(permanentJourneyPlans.areaToBeVisited, `%${search}%`)
    );
    if (searchCondition) filters.push(searchCondition);
  }

  if (salesmanId && salesmanId !== 'all') filters.push(eq(permanentJourneyPlans.userId, Number(salesmanId)));
  if (status && status !== 'all') filters.push(ilike(permanentJourneyPlans.status, status));
  if (fromDate) filters.push(gte(permanentJourneyPlans.planDate, fromDate));
  if (toDate) filters.push(lte(permanentJourneyPlans.planDate, toDate));

  const whereClause = and(...filters);

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
    .where(whereClause)
    .orderBy(desc(permanentJourneyPlans.planDate), desc(permanentJourneyPlans.createdAt))
    .limit(pageSize)
    .offset(page * pageSize);

  const totalCountResult = await db
    .select({ count: count() })
    .from(permanentJourneyPlans)
    .leftJoin(users, eq(permanentJourneyPlans.userId, users.id))
    .where(whereClause);

  const totalCount = Number(totalCountResult[0].count);

  const pjpIds = rawPlans.map(p => p.id);
  const tasks = pjpIds.length > 0 
    ? await db
        .select({ id: dailyTasks.id, pjpId: dailyTasks.id }) // Keeping your existing mapping logic
        .from(dailyTasks)
        .where(inArray(dailyTasks.id, pjpIds))
    : [];

  const tasksByPjpId = tasks.reduce((acc, task) => {
    if (task.pjpId) {
        if (!acc[task.pjpId]) acc[task.pjpId] = [];
        acc[task.pjpId].push(task.id);
    }
    return acc;
  }, {} as Record<string, string[]>);

  const formattedData = rawPlans.map((row) => {
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

  return { data: formattedData, totalCount };
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
    const action = searchParams.get('action');

    // --- Action: Fetch Distinct Filters ---
    if (action === 'fetch_filters') {
      const distinctSalesmen = await db
        .selectDistinct({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(permanentJourneyPlans)
        .innerJoin(users, eq(permanentJourneyPlans.userId, users.id))
        .where(eq(users.companyId, currentUser.companyId))
        .orderBy(asc(users.firstName));
        
      const distinctStatuses = await db
        .selectDistinct({ status: permanentJourneyPlans.status })
        .from(permanentJourneyPlans)
        .innerJoin(users, eq(permanentJourneyPlans.userId, users.id))
        .where(eq(users.companyId, currentUser.companyId));

      return NextResponse.json({
        salesmen: distinctSalesmen,
        statuses: distinctStatuses.map(s => s.status).filter(Boolean).sort()
      }, { status: 200 });
    }

    // --- Default Action: Fetch Paginated PJPs ---
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);
    
    const search = searchParams.get('search');
    const salesmanId = searchParams.get('salesmanId');
    const status = searchParams.get('status');
    const verificationStatus = searchParams.get('verificationStatus');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const result = await getCachedPJPs(
      currentUser.companyId,
      page,
      pageSize,
      search,
      salesmanId,
      status,
      verificationStatus,
      fromDate,
      toDate
    );
    
    const validatedData = z.array(frontendPJPSchema.loose()).safeParse(result.data);

    if (!validatedData.success) {
      console.error("PJP Validation Error:", validatedData.error.format());
      return NextResponse.json({ data: result.data, totalCount: result.totalCount, page, pageSize }, { status: 200 }); 
    }

    return NextResponse.json({
      data: validatedData.data,
      totalCount: result.totalCount,
      page,
      pageSize
    }, { status: 200 });

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