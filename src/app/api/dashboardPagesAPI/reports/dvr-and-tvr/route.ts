// src/app/api/dashboardPagesAPI/routes/dvr-and-tvr/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { 
  users, 
  dailyVisitReports, 
  technicalVisitReports, 
  dealers, 
  dailyTasks 
} from '../../../../../../drizzle';
import { 
  eq, desc, and, or, ilike, aliasedTable, getTableColumns, count, SQL, inArray 
} from 'drizzle-orm';

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
];

async function getCachedHybridReports(
  companyId: number,
  page: number,
  pageSize: number,
  search: string | null
) {
  'use cache';
  cacheLife('hours');
  cacheTag(`hybrid-reports-${companyId}`);
  
  // Unique cache tag based on active filters and pagination
  const filterKey = `${search || 'none'}`;
  cacheTag(`hybrid-reports-${companyId}-${page}-${filterKey}`);

  const subDealers = aliasedTable(dealers, 'subDealers');

  // --- THE CORE FILTER: Only users in these specific areas ---
  const kamrupAreaFilter = inArray(users.area, ['Kamrup-TSO', 'Kamrup TSO']);

  // ==========================================
  // 1. FETCH DVRs FOR THESE USERS
  // ==========================================
  const dvrFilters: (SQL | undefined)[] = [
    eq(users.companyId, companyId),
    kamrupAreaFilter
  ];

  if (search) {
    dvrFilters.push(
      or(
        ilike(users.firstName, `%${search}%`),
        ilike(users.lastName, `%${search}%`),
        ilike(dealers.name, `%${search}%`),
        ilike(dailyVisitReports.nameOfParty, `%${search}%`)
      )
    );
  }

  const dvrWhereClause = and(...dvrFilters);

  const rawDvrs = await db
    .select({
      ...getTableColumns(dailyVisitReports),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      dealerNameStr: dealers.name,
      subDealerNameStr: subDealers.name,
      pjpTaskStatus: dailyTasks.status, 
      pjpVisitType: dailyTasks.visitType,
    })
    .from(dailyVisitReports)
    .innerJoin(users, eq(dailyVisitReports.userId, users.id))
    .leftJoin(
      dailyTasks, 
      or(
        eq(dailyVisitReports.dailyTaskId, dailyTasks.id), 
        and( 
          eq(dailyVisitReports.userId, dailyTasks.userId),
          eq(dailyVisitReports.reportDate, dailyTasks.taskDate),
          eq(dailyVisitReports.dealerId, dailyTasks.dealerId)
        )
      )
    )
    .leftJoin(dealers, eq(dailyVisitReports.dealerId, dealers.id))
    .leftJoin(subDealers, eq(dailyVisitReports.subDealerId, subDealers.id))
    .where(dvrWhereClause)
    .orderBy(desc(dailyVisitReports.reportDate))
    .limit(pageSize)
    .offset(page * pageSize);

  const dvrCountResult = await db
    .select({ count: count() })
    .from(dailyVisitReports)
    .innerJoin(users, eq(dailyVisitReports.userId, users.id))
    .leftJoin(dealers, eq(dailyVisitReports.dealerId, dealers.id))
    .leftJoin(subDealers, eq(dailyVisitReports.subDealerId, subDealers.id))
    .where(dvrWhereClause);

  const formattedDvrs = rawDvrs.map(row => {
    const finalPjpStatus = (!row.pjpTaskStatus || row.pjpVisitType?.toLowerCase() === 'unplanned')
      ? 'Unplanned'
      : row.pjpTaskStatus;

    return {
      ...row,
      salesmanName: `${row.userFirstName || ''} ${row.userLastName || ''}`.trim() || row.userEmail || 'Unknown',
      dealerName: row.dealerNameStr ?? null,
      subDealerName: row.subDealerNameStr ?? null,
      pjpStatus: finalPjpStatus,
    };
  });

  // ==========================================
  // 2. FETCH TVRs FOR THESE USERS
  // ==========================================
  const tvrFilters: (SQL | undefined)[] = [
    eq(users.companyId, companyId),
    kamrupAreaFilter
  ];

  if (search) {
    tvrFilters.push(
      or(
        ilike(users.firstName, `%${search}%`),
        ilike(users.lastName, `%${search}%`),
        ilike(technicalVisitReports.siteNameConcernedPerson, `%${search}%`),
        ilike(technicalVisitReports.associatedPartyName, `%${search}%`)
      )
    );
  }

  const tvrWhereClause = and(...tvrFilters);

  const rawTvrs = await db
    .select({
      ...getTableColumns(technicalVisitReports),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
    })
    .from(technicalVisitReports)
    .innerJoin(users, eq(technicalVisitReports.userId, users.id))
    .where(tvrWhereClause)
    .orderBy(desc(technicalVisitReports.reportDate))
    .limit(pageSize)
    .offset(page * pageSize);

  const tvrCountResult = await db
    .select({ count: count() })
    .from(technicalVisitReports)
    .innerJoin(users, eq(technicalVisitReports.userId, users.id))
    .where(tvrWhereClause);

  const formattedTvrs = rawTvrs.map(row => ({
    ...row,
    salesmanName: `${row.userFirstName || ''} ${row.userLastName || ''}`.trim() || row.userEmail || 'Unknown',
  }));

  return {
    dvrs: {
      data: formattedDvrs,
      totalCount: Number(dvrCountResult[0].count),
    },
    tvrs: {
      data: formattedTvrs,
      totalCount: Number(tvrCountResult[0].count),
    }
  };
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
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);
    const search = searchParams.get('search');

    const cachedResult = await getCachedHybridReports(
      currentUser.companyId,
      page,
      pageSize,
      search
    );

    return NextResponse.json({
      ...cachedResult,
      page,
      pageSize
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching hybrid Kamrup-TSO reports:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch hybrid reports', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}